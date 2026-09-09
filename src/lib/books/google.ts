import type { NormalizedBook } from './types';
import { cleanIsbn } from './isbn';
import { htmlToPlainText } from './normalize';
import {
  type GoogleVolume,
  readAvailability,
  readSeries,
  readPrintType,
  largestImageLink,
} from './google-volume';

/**
 * Клиент Google Books API.
 * Документация: https://developers.google.com/books/docs/v1/using
 *
 * Ключ ОБЯЗАТЕЛЕН. Раньше здесь было написано, что он лишь снимает
 * лимиты, - это неверно. Запрос без ключа получает от Google 429 с
 * quota_limit_value = 0: дневная квота анонимных обращений равна нулю,
 * то есть источник не работает вовсе, а не работает медленнее.
 * Ошибку в ответе видно целиком:
 *   "Quota exceeded for quota metric 'Queries' and limit 'Queries per day'"
 * Ключ выставляется в GOOGLE_BOOKS_API_KEY.
 */

const ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';

/**
 * Ключ не задан - источник не настроен.
 *
 * Отдельный тип ошибки, чтобы «мы не настроили» не выглядело в
 * интерфейсе так же, как «Google сейчас не отвечает»: чинится это
 * совершенно по-разному.
 */
export class GoogleBooksNotConfiguredError extends Error {
  constructor() {
    super('Не задан GOOGLE_BOOKS_API_KEY - Google Books не отвечает без ключа');
    this.name = 'GoogleBooksNotConfiguredError';
  }
}

/** Ключ доступа к Books API или явная ошибка настройки. */
export function requireApiKey(): string {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) throw new GoogleBooksNotConfiguredError();
  return key;
}

interface GoogleResponse {
  items?: GoogleVolume[];
}

/** Приводит том Google Books к нормализованному виду. */
function normalizeVolume(volume: GoogleVolume): NormalizedBook | null {
  const info = volume.volumeInfo;
  if (!info?.title) return null;

  const ids = info.industryIdentifiers ?? [];
  const isbn13 = ids.find((i) => i.type === 'ISBN_13')?.identifier ?? null;
  const isbn10 = ids.find((i) => i.type === 'ISBN_10')?.identifier ?? null;

  const cover = largestImageLink(info);
  const availability = readAvailability(volume);

  return {
    source: 'google',
    sourceId: volume.id,
    isbn13: isbn13 ? cleanIsbn(isbn13) : null,
    isbn10: isbn10 ? cleanIsbn(isbn10) : null,
    title: info.title,
    subtitle: info.subtitle ?? null,
    authors: info.authors ?? [],
    description: info.description ? htmlToPlainText(info.description) : null,
    coverUrl: cover,
    pageCount: info.pageCount ?? info.printedPageCount ?? null,
    publishedDate: info.publishedDate ?? null,
    publisher: info.publisher ?? null,
    sourceUrl: info.canonicalVolumeLink ?? info.infoLink ?? null,
    printType: readPrintType(info, volume.saleInfo?.isEbook),
    availability,
    series: readSeries(info),
    language: info.language ?? null,
    genres: info.categories ?? [],
    mediaType: 'book',
    externalRating:
      typeof info.averageRating === 'number' && (info.ratingsCount ?? 0) > 0
        ? { average: info.averageRating, count: info.ratingsCount ?? 0 }
        : null,
  };
}

/**
 * Ищет книги в Google Books.
 *
 * Язык здесь намеренно НЕ фильтруется. Параметр langRestrict у Google
 * работает как жесткий фильтр по метаданным тома, а у русских изданий язык
 * проставлен далеко не всегда: с langRestrict=ru запрос «Лавр Водолазкин»
 * возвращал пусто. Предпочтение русскому изданию делается ранжированием
 * в search.ts - оно меняет порядок выдачи, но ничего из нее не выбрасывает.
 *
 * @param query   свободный текст или ISBN
 * @param options isbn — поиск строго по ISBN; signal — для тайм-аута
 */
export async function searchGoogleBooks(
  query: string,
  options: { isbn?: boolean; signal?: AbortSignal; limit?: number } = {},
): Promise<NormalizedBook[]> {
  const { isbn = false, signal, limit = 20 } = options;
  const q = isbn ? `isbn:${cleanIsbn(query)}` : query;

  const url = new URL(ENDPOINT);
  url.searchParams.set('q', q);
  url.searchParams.set('maxResults', String(Math.min(limit, 40)));
  url.searchParams.set('printType', 'books');
  url.searchParams.set('key', requireApiKey());

  let res = await fetch(url, { signal, next: { revalidate: 3600 } });

  // 5xx у Google Books бывают разовыми: наблюдали 503 backendFailed на
  // запросе, который тут же проходил повторно. Без этой попытки источник
  // молча выпадает из выдачи, и её целиком тянет OpenLibrary - с
  // транслитерированными названиями вместо русских.
  if (res.status >= 500) {
    res = await fetch(url, { signal, cache: 'no-store' });
  }

  if (!res.ok) {
    throw new Error(`Google Books вернул ${res.status}`);
  }

  const data = (await res.json()) as GoogleResponse;
  return (data.items ?? [])
    .map(normalizeVolume)
    .filter((b): b is NormalizedBook => b !== null);
}
