import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey, GoogleBooksNotConfiguredError } from '@/lib/books/google';
import {
  type GoogleVolume,
  readAvailability,
  readSeries,
  readPrintType,
  largestImageLink,
} from '@/lib/books/google-volume';

/**
 * ВРЕМЕННЫЙ диагностический маршрут: что Google Books знает про том и
 * какие обложки у него на самом деле есть.
 *
 * Нужен, потому что ни одна доступная разработчику машина до Google не
 * достает: сеть заказчика режет google.com по SNI, а окружение
 * ассистента упирается в запрет egress-политики на books.google.com и
 * в нулевую анонимную квоту Books API. Сервер Vercel ходит наружу
 * свободно и с ключом - спрашиваем у него.
 *
 * Здесь ничего не предполагается: каждый вариант обложки скачивается и
 * измеряется, размер в пикселях читается из заголовка самой картинки.
 *
 * Открыть: /api/debug/volume?id=jBiIQlevopYC
 *          /api/debug/volume?q=Лукьяненко Спектр
 *
 * Ключ не отдает: он уходит в строке запроса и обратно не возвращается.
 * УДАЛИТЬ вместе с /api/debug/search-probe.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Размер картинки из ее собственного заголовка.
 *
 * Content-Length говорит про байты, а нам нужны пиксели: только по ним
 * видно, отличается ли zoom=3 от zoom=1 на самом деле или Google отдает
 * одну и ту же картинку под разными адресами.
 */
function imageSize(buf: Buffer): { width: number; height: number } | null {
  // PNG: ширина и высота лежат в IHDR сразу после подписи.
  if (buf.length > 24 && buf.toString('ascii', 1, 4) === 'PNG') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // GIF: little-endian, сразу после версии.
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  // JPEG: идем по сегментам до маркера SOF, в нем и лежат размеры.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buf[offset + 1];
      // SOF0..SOF15, кроме DHT (c4), JPGA (c8) и DAC (cc).
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof) {
        return {
          height: buf.readUInt16BE(offset + 5),
          width: buf.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + buf.readUInt16BE(offset + 2);
    }
  }

  return null;
}

interface Probe {
  url: string;
  status: number | null;
  contentType: string | null;
  bytes: number;
  pixels: string | null;
  note?: string;
}

/** Скачивает вариант обложки и измеряет его. */
async function probeCover(url: string): Promise<Probe> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { 'User-Agent': 'KnizhnayaPolka/1.0 (book club)' },
    });
    const contentType = res.headers.get('content-type');
    if (!res.ok) {
      return { url, status: res.status, contentType, bytes: 0, pixels: null };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const size = imageSize(buf);
    return {
      url,
      status: res.status,
      contentType,
      bytes: buf.byteLength,
      pixels: size ? `${size.width}x${size.height}` : null,
      note:
        buf.byteLength < 1024
          ? 'меньше килобайта - это заглушка, а не обложка'
          : undefined,
    };
  } catch (error) {
    return {
      url,
      status: null,
      contentType: null,
      bytes: 0,
      pixels: null,
      note: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Находит id тома по свободному запросу. */
async function findVolumeId(query: string): Promise<string | null> {
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('printType', 'books');
  url.searchParams.set('key', requireApiKey());

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: { id?: string }[] };
  return data.items?.[0]?.id ?? null;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')?.trim();
  const query = req.nextUrl.searchParams.get('q')?.trim() || 'Лукьяненко Спектр';

  let volumeId: string | null;
  try {
    volumeId = id || (await findVolumeId(query));
  } catch (error) {
    if (error instanceof GoogleBooksNotConfiguredError) {
      return NextResponse.json(
        { ошибка: error.message, чтоДелать: 'задать GOOGLE_BOOKS_API_KEY в Vercel' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    throw error;
  }

  if (!volumeId) {
    return NextResponse.json(
      { запрос: query, ошибка: 'том не найден' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const url = new URL(`https://www.googleapis.com/books/v1/volumes/${volumeId}`);
  url.searchParams.set('key', requireApiKey());
  const res = await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return NextResponse.json(
      { том: volumeId, статус: res.status, ответGoogle: body.slice(0, 600) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const volume = (await res.json()) as GoogleVolume;
  const info = volume.volumeInfo ?? {};

  // Все варианты обложки: и те, что Google назвал сам, и собранные по
  // шаблону с разным zoom. Каждый скачивается и измеряется.
  const fromApi = Object.entries(info.imageLinks ?? {}).map(([name, link]) => ({
    name,
    url: link.replace(/^http:/, 'https:'),
  }));
  const base = `https://books.google.com/books/content?id=${volumeId}&printsec=frontcover&img=1&source=gbs_api`;
  const byZoom = [0, 1, 2, 3, 4, 5].map((z) => ({
    name: `zoom=${z}`,
    url: `${base}&zoom=${z}`,
  }));

  const measured = await Promise.all(
    [...fromApi, ...byZoom].map(async (candidate) => ({
      вариант: candidate.name,
      ...(await probeCover(candidate.url)),
    })),
  );

  return NextResponse.json(
    {
      том: volumeId,
      название: info.title,
      обложки: measured,
      разобраноНами: {
        обложкаИзApi: largestImageLink(info),
        издательство: info.publisher ?? null,
        датаИздания: info.publishedDate ?? null,
        страниц: info.pageCount ?? info.printedPageCount ?? null,
        язык: info.language ?? null,
        жанры: info.categories ?? [],
        формат: readPrintType(info, volume.saleInfo?.isEbook),
        серия: readSeries(info),
        доступность: readAvailability(volume),
        рейтинг:
          typeof info.averageRating === 'number'
            ? { среднее: info.averageRating, оценок: info.ratingsCount ?? 0 }
            : null,
        описаниеСРазметкой: /<[a-z][^>]*>/i.test(info.description ?? ''),
      },
      сырыеПоля: {
        volumeInfo: Object.keys(info).sort(),
        saleInfo: Object.keys(volume.saleInfo ?? {}).sort(),
        accessInfo: Object.keys(volume.accessInfo ?? {}).sort(),
      },
      какЧитать: [
        'обложки: pixels - настоящий размер картинки, прочитанный из ее заголовка.',
        'Если у разных zoom одинаковые pixels - Google отдает одну и ту же картинку, и перебирать их незачем.',
        'bytes меньше 1024 - заглушка: Google отвечает 200 и отдает пустую картинку.',
        'сырыеПоля - полный список того, что Google вообще прислал по этому тому.',
        'разобраноНами - что из этого стало данными приложения.',
      ],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
