import type { NormalizedBook } from './types';
import { cleanIsbn } from './isbn';
import { htmlToPlainText } from './normalize';

/**
 * Клиент Google Books API.
 * Документация: https://developers.google.com/books/docs/v1/using
 * Ключ необязателен, но снимает строгие лимиты (выставляется в GOOGLE_BOOKS_API_KEY).
 */

const ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';

interface GoogleVolume {
  id: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    language?: string;
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
    industryIdentifiers?: { type: string; identifier: string }[];
    averageRating?: number;
    ratingsCount?: number;
    infoLink?: string;
    canonicalVolumeLink?: string;
  };
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

  // Берём самую крупную из доступных: в выдаче обложка небольшая, но
  // эта же запись уходит в каталог, а оттуда - на страницу книги.
  // Протокол и лишние параметры чинит resolveCoverUrl.
  const images = info.imageLinks ?? {};
  const cover =
    images.extraLarge ??
    images.large ??
    images.medium ??
    images.small ??
    images.thumbnail ??
    images.smallThumbnail ??
    null;

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
    pageCount: info.pageCount ?? null,
    publishedDate: info.publishedDate ?? null,
    publisher: info.publisher ?? null,
    sourceUrl: info.canonicalVolumeLink ?? info.infoLink ?? null,
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
 * работает как жёсткий фильтр по метаданным тома, а у русских изданий язык
 * проставлен далеко не всегда: с `langRestrict=ru` запрос «Лавр Водолазкин»
 * возвращал пусто. Предпочтение русскому изданию делается ранжированием
 * в search.ts — оно меняет порядок выдачи, но ничего из неё не выбрасывает.
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
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    url.searchParams.set('key', process.env.GOOGLE_BOOKS_API_KEY);
  }

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
