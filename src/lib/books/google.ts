import type { NormalizedBook } from './types';
import { cleanIsbn } from './isbn';

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
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    language?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
    averageRating?: number;
    ratingsCount?: number;
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

  // Google отдаёт обложки по http — принудительно переводим на https
  const cover =
    info.imageLinks?.thumbnail?.replace(/^http:/, 'https:') ??
    info.imageLinks?.smallThumbnail?.replace(/^http:/, 'https:') ??
    null;

  return {
    source: 'google',
    sourceId: volume.id,
    isbn13: isbn13 ? cleanIsbn(isbn13) : null,
    isbn10: isbn10 ? cleanIsbn(isbn10) : null,
    title: info.title,
    subtitle: info.subtitle ?? null,
    authors: info.authors ?? [],
    description: info.description ?? null,
    coverUrl: cover,
    pageCount: info.pageCount ?? null,
    publishedDate: info.publishedDate ?? null,
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
 * @param query   свободный текст или ISBN
 * @param options isbn — поиск строго по ISBN; signal — для тайм-аута;
 *                lang — код языка для langRestrict
 */
export async function searchGoogleBooks(
  query: string,
  options: {
    isbn?: boolean;
    signal?: AbortSignal;
    limit?: number;
    lang?: string | null;
  } = {},
): Promise<NormalizedBook[]> {
  const { isbn = false, signal, limit = 20, lang = null } = options;
  const q = isbn ? `isbn:${cleanIsbn(query)}` : query;

  const url = new URL(ENDPOINT);
  url.searchParams.set('q', q);
  url.searchParams.set('maxResults', String(Math.min(limit, 40)));
  url.searchParams.set('printType', 'books');
  // Поиск по ISBN однозначен — язык там только мешает.
  if (lang && !isbn) {
    url.searchParams.set('langRestrict', lang);
  }
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    url.searchParams.set('key', process.env.GOOGLE_BOOKS_API_KEY);
  }

  const res = await fetch(url, { signal, next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`Google Books вернул ${res.status}`);
  }

  const data = (await res.json()) as GoogleResponse;
  return (data.items ?? [])
    .map(normalizeVolume)
    .filter((b): b is NormalizedBook => b !== null);
}
