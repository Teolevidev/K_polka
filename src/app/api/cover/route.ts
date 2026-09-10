import { NextRequest, NextResponse } from 'next/server';

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

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const size = (params.get('size') ?? 'm') as Size;
  const id = params.get('g');
  const isbn = params.get('isbn');
  const direct = params.get('u');

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

  if (candidates.length === 0) {
    return new NextResponse('нужен параметр g, isbn или u', { status: 400 });
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
