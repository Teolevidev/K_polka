import { NextRequest, NextResponse } from 'next/server';
import { readImageSize, looksLikeCover } from '@/lib/books/image-size';

/**
 * Обложки книг через наш домен.
 *
 * Зачем не отдавать ссылку на books.google.com напрямую:
 *
 *  1. У части российских провайдеров google.com режется по SNI - TLS не
 *     устанавливается вовсе. У читателя с таким провайдером обложка не
 *     загрузится никогда, сколько ни обновляй. Запрос к нашему домену
 *     проходит.
 *  2. Google отдает обложки без внятного кеширования, а через нас
 *     картинка кладется в CDN на год: с полки в двадцать книг это
 *     двадцать запросов в Google на всю аудиторию, а не на каждого.
 *  3. У одного тома несколько вариантов картинки разного размера, и
 *     какие из них существуют - у каждого тома по-разному. Перебор
 *     делается здесь, на сервере, а не в браузере читателя.
 *
 * Открытым прокси маршрут при этом не становится: произвольный адрес он
 * не примет. Либо идентификатор тома и ISBN, из которых адрес собирается
 * по шаблону, либо готовая ссылка - но только на хост из белого списка.
 */

export const runtime = 'nodejs';

/** Хосты, картинки с которых мы согласны отдавать. */
const ALLOWED_HOSTS = new Set([
  'books.google.com',
  'books.googleusercontent.com',
  'covers.openlibrary.org',
]);

const FETCH_TIMEOUT_MS = 8_000;

/**
 * Ответ короче этого - не картинка, а заглушка.
 * Google на отсутствующую обложку отвечает 200 и отдает крошечный
 * прозрачный GIF, поэтому по коду ответа отличить нельзя.
 */
const MIN_IMAGE_BYTES = 1024;

type Size = 's' | 'm' | 'l';

/**
 * Лестница размеров обложки Google - по замерам, а не по догадке.
 *
 * Параметр zoom НЕ монотонный: больше значение не значит больше
 * картинка. Замерено на томе jBiIQlevopYC («Спектр»), размеры прочитаны
 * из заголовков самих файлов:
 *
 *   zoom=1  128x194     12 КБ     zoom=5 - то же самое
 *   zoom=2  300x454     29 КБ
 *   zoom=3  575x871     88 КБ
 *   zoom=4  800x1211   143 КБ
 *   zoom=0  1744x2641  532 КБ     zoom=6 - то же самое
 *
 * Отсюда два вывода. Первый: для карточки в выдаче нужен zoom=2, а не
 * zoom=1 - разница в размере файла втрое, зато картинка не мыло.
 * Второй: zoom=0 в полтора раза тяжелее всей остальной страницы, и
 * ставить его в ленту нельзя; он остается на случай, когда понадобится
 * действительно большая картинка.
 *
 * Порядок внутри размера - от нужного к запасному: если у тома
 * какого-то варианта нет, берется следующий.
 */
const ZOOM_LADDER: Record<Size, number[]> = {
  s: [2, 1],
  m: [3, 2, 1],
  l: [4, 3, 2],
};

/**
 * Адреса вариантов обложки, собранные по идентификатору тома.
 *
 * Токен imgtk из imageLinks не нужен: замер показал, что адрес без него
 * отдает ту же картинку. Это важнее, чем кажется - значит, обложку можно
 * запросить, ни разу не сходив в API, и сохраненная ссылка не протухнет
 * вместе с токеном.
 *
 * edge=curl тоже не ставим: он подрисовывает загнутый уголок страницы,
 * который мы все равно срезаем кадрированием, и добавляет пару
 * килобайт.
 */
function googleCandidates(id: string, size: Size): string[] {
  const base = `https://books.google.com/books/content?id=${encodeURIComponent(id)}&printsec=frontcover&img=1&source=gbs_api`;
  return ZOOM_LADDER[size].map((z) => `${base}&zoom=${z}`);
}

function openLibraryCandidates(isbn: string, size: Size): string[] {
  const letter = size === 'l' ? 'L' : size === 'm' ? 'M' : 'S';
  // default=false принципиален: без него OpenLibrary отдает серую
  // заглушку с кодом 200 вместо честной 404.
  return [
    `https://covers.openlibrary.org/b/isbn/${isbn}-${letter}.jpg?default=false`,
  ];
}

interface Fetched {
  body: ArrayBuffer;
  contentType: string;
  url: string;
  /** Почему картинка не подошла - уходит в заголовок ответа. */
  reason?: string;
}

/** Скачивает картинку, если по адресу действительно картинка. */
async function fetchImage(url: string): Promise<Fetched | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // Referer не шлем: часть каталогов на чужой Referer отвечает 403.
      referrerPolicy: 'no-referrer',
      headers: { 'User-Agent': 'KnizhnayaPolka/1.0 (book club)' },
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return null;

    const body = await res.arrayBuffer();
    if (body.byteLength < MIN_IMAGE_BYTES) return null;

    // Каталоги под видом обложки отдают и титульные листы, и развороты.
    // Карточка кадрирует картинку по 2:3, и такая «обложка» выглядит на
    // экране гигантским куском буквы. Пропускаем только книжные
    // пропорции, остальное отдаем следующему кандидату.
    if (!looksLikeCover(readImageSize(Buffer.from(body)))) return null;

    return { body, contentType, url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Проверяет, что готовая ссылка ведет на разрешенный хост. */
function allowedUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (!ALLOWED_HOSTS.has(parsed.hostname)) return null;
    parsed.protocol = 'https:';
    return parsed.toString();
  } catch {
    return null;
  }
}

const VOLUME_ID = /^[A-Za-z0-9_-]{5,32}$/;
const ISBN = /^[0-9]{9,13}[0-9Xx]?$/;

/** Кавычки внутри значения ломают операторы поиска - выкидываем их. */
function quoted(value: string): string {
  return `"${value.replace(/[\"«»]/g, ' ').trim().slice(0, 120)}"`;
}

/**
 * Обложки других изданий того же произведения.
 *
 * Последняя попытка, когда у самого издания картинки нет. У редких
 * книг такое сплошь и рядом: конкретный том без обложки, а у соседнего
 * издания та же книга с нормальной картинкой. Читателю важна книга, а
 * не то, чье именно это издание.
 *
 * Спрашиваем оба каталога: Google лучше знает русские издания,
 * OpenLibrary отвечает без ключа и выручает, когда ключа нет.
 */
async function siblingCandidates(
  title: string,
  author: string | null,
): Promise<string[]> {
  const urls: string[] = [];

  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (key) {
    try {
      const q = author
        ? `intitle:${quoted(title)} inauthor:${quoted(author)}`
        : `intitle:${quoted(title)}`;
      const url = new URL('https://www.googleapis.com/books/v1/volumes');
      url.searchParams.set('q', q);
      url.searchParams.set('maxResults', '5');
      url.searchParams.set('printType', 'books');
      url.searchParams.set('key', key);

      const res = await fetch(url, { next: { revalidate: 86400 } });
      if (res.ok) {
        const data = (await res.json()) as {
          items?: { id?: string; volumeInfo?: { imageLinks?: object } }[];
        };
        for (const item of data.items ?? []) {
          // Без imageLinks у тома обложки нет - незачем и ходить.
          if (item.id && item.volumeInfo?.imageLinks) {
            urls.push(...googleCandidates(item.id, 'm'));
          }
        }
      }
    } catch {
      // Соседнее издание - роскошь, а не обязанность: молча пропускаем.
    }
  }

  try {
    const url = new URL('https://openlibrary.org/search.json');
    url.searchParams.set('title', title.slice(0, 120));
    if (author) url.searchParams.set('author', author.slice(0, 80));
    url.searchParams.set('fields', 'cover_i');
    url.searchParams.set('limit', '5');

    const res = await fetch(url, {
      headers: { 'User-Agent': 'KnizhnayaPolka/1.0 (book club)' },
      next: { revalidate: 86400 },
    });
    if (res.ok) {
      const data = (await res.json()) as { docs?: { cover_i?: number }[] };
      for (const doc of data.docs ?? []) {
        if (doc.cover_i) {
          urls.push(`https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`);
        }
      }
    }
  } catch {
    // то же самое
  }

  return urls;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const size = (params.get('size') ?? 'm') as Size;
  const id = params.get('g');
  const isbn = params.get('isbn');
  const direct = params.get('u');
  const title = params.get('t');
  const author = params.get('a');

  const candidates: string[] = [];

  // Собранный по идентификатору адрес идет первым, а готовый - запасным.
  // В готовом сидит токен imgtk и edge=curl: картинка та же, но тяжелее,
  // и на нее нельзя положиться надолго. Собранный адрес стабилен.
  if (id && VOLUME_ID.test(id)) {
    candidates.push(...googleCandidates(id, size));
  }
  if (direct) {
    const safe = allowedUrl(direct);
    if (safe) candidates.push(safe);
  }
  if (isbn && ISBN.test(isbn)) {
    candidates.push(...openLibraryCandidates(isbn, size));
  }

  if (candidates.length === 0 && !title) {
    return new NextResponse('нужен параметр g, isbn, u или t', { status: 400 });
  }

  // Если у самого издания картинки не нашлось, ищем ее у соседних
  // изданий того же произведения. Запрос в каталог делается только
  // здесь, в последней попытке, - на каждую обложку так ходить нельзя.
  if (title) {
    candidates.push(...(await siblingCandidates(title, author)));
  }

  for (const candidate of candidates) {
    const image = await fetchImage(candidate);
    if (!image) continue;

    return new NextResponse(image.body, {
      status: 200,
      headers: {
        'Content-Type': image.contentType,
        // Обложка издания не меняется, поэтому кешируем надолго и
        // разрешаем отдавать устаревшую копию, пока обновляем.
        'Cache-Control':
          'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800',
        // Чтобы было видно, какой вариант сработал, не открывая логи.
        'X-Cover-Source': new URL(image.url).hostname,
      },
    });
  }

  // Обложки нет ни в одном источнике. Кешируем ненадолго: она может
  // появиться позже, и вечный отрицательный ответ этому помешает.
  return new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
