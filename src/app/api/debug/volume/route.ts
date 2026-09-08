import { NextRequest, NextResponse } from 'next/server';

/**
 * ВРЕМЕННЫЙ диагностический маршрут: что Google Books знает про том.
 *
 * Отвечает на вопрос «мы явно не то забираем»: показывает сырой
 * volumeInfo целиком и рядом - что из него берём мы. Видно сразу, чего
 * у Google нет вовсе (биографии автора, других изданий), а что есть, но
 * мы этого не читали.
 *
 * Открыть: /api/debug/volume?q=Лукьяненко Спектр
 *          /api/debug/volume?id=<googleVolumeId>
 *
 * Ключ не отдаёт: он уходит в строке запроса и обратно не возвращается.
 * УДАЛИТЬ вместе с /api/debug/search-probe.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEY = () => process.env.GOOGLE_BOOKS_API_KEY;

interface VolumeInfo {
  title?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  pageCount?: number;
  categories?: string[];
  language?: string;
  averageRating?: number;
  ratingsCount?: number;
  imageLinks?: Record<string, string>;
  industryIdentifiers?: { type: string; identifier: string }[];
  canonicalVolumeLink?: string;
}

async function json<T>(url: URL): Promise<{ status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { status: res.status, data: null, error: body.slice(0, 300) };
    }
    return { status: res.status, data: (await res.json()) as T };
  } catch (error) {
    return {
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Находит id тома по свободному запросу. */
async function findVolumeId(query: string): Promise<string | null> {
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('printType', 'books');
  if (KEY()) url.searchParams.set('key', KEY() as string);

  const res = await json<{ items?: { id?: string }[] }>(url);
  return res.data?.items?.[0]?.id ?? null;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')?.trim();
  const query = req.nextUrl.searchParams.get('q')?.trim() || 'Лукьяненко Спектр';

  const volumeId = id || (await findVolumeId(query));
  if (!volumeId) {
    return NextResponse.json(
      { запрос: query, ошибка: 'том не найден - Google ничего не вернул' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const url = new URL(`https://www.googleapis.com/books/v1/volumes/${volumeId}`);
  if (KEY()) url.searchParams.set('key', KEY() as string);
  const res = await json<{ volumeInfo?: VolumeInfo }>(url);

  const info = res.data?.volumeInfo;
  if (!info) {
    return NextResponse.json(
      { запрос: query, том: volumeId, статус: res.status, ошибка: res.error },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    {
      запрос: query,
      том: volumeId,
      ключGoogleЗадан: Boolean(KEY()),
      // Главное: какие размеры обложки Google реально отдаёт. Если тут
      // только smallThumbnail - крупной картинки у него просто нет.
      обложки: info.imageLinks ?? 'imageLinks отсутствует - обложки у тома нет',
      наличиеПолей: {
        издательство: info.publisher ?? null,
        датаИздания: info.publishedDate ?? null,
        страниц: info.pageCount ?? null,
        язык: info.language ?? null,
        жанры: info.categories ?? [],
        рейтинг:
          typeof info.averageRating === 'number'
            ? { среднее: info.averageRating, оценок: info.ratingsCount ?? 0 }
            : null,
        isbn: info.industryIdentifiers ?? [],
        ссылкаНаКарточку: info.canonicalVolumeLink ?? null,
        описаниеСРазметкой: /<[a-z][^>]*>/i.test(info.description ?? ''),
        длинаОписания: info.description?.length ?? 0,
      },
      сырыеПоля: Object.keys(info).sort(),
      какЧитать: [
        'обложки: список размеров. extraLarge/large есть далеко не у всех томов.',
        'описаниеСРазметкой = true - в описании HTML, его надо чистить (чистим).',
        'сырыеПоля - полный список того, что Google вообще прислал по этому тому.',
        'Биографии автора и списка других изданий в API нет: на сайте Google берёт их из графа знаний.',
      ],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
