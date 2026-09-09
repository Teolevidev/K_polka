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
 * Варианты обложки Google от крупного к мелкому.
 *
 * Это те же адреса, что приходят в imageLinks: у них общая база и
 * различается только zoom. Какие из них существуют у конкретного тома -
 * заранее не известно, поэтому перебираем по порядку и берем первый
 * настоящий.
 */
function googleCandidates(id: string, size: Size): string[] {
  const base = `https://books.google.com/books/content?id=${encodeURIComponent(id)}&printsec=frontcover&img=1&source=gbs_api`;
  const zooms = size === 'l' ? [3, 2, 1] : size === 'm' ? [2, 1] : [1];
  // edge=curl подрисовывает загнутый уголок - он нам не нужен, мы
  // кадрируем обложку по object-cover и уголок все равно срезается.
  return zooms.map((z) => `${base}&zoom=${z}`);
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

  if (direct) {
    const safe = allowedUrl(direct);
    if (safe) candidates.push(safe);
  }
  if (id && VOLUME_ID.test(id)) {
    candidates.push(...googleCandidates(id, size));
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
