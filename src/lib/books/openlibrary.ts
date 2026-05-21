import type { NormalizedBook } from './types';
import { cleanIsbn, isValidIsbn13, isValidIsbn10 } from './isbn';

/**
 * Клиент OpenLibrary API.
 * Документация: https://openlibrary.org/dev/docs/api/search
 * Полностью открытый, ключ не нужен. Хорошо дополняет Google Books,
 * особенно по редким и старым изданиям.
 */

const SEARCH_ENDPOINT = 'https://openlibrary.org/search.json';
const COVER_BASE = 'https://covers.openlibrary.org/b';

const FIELDS = [
  'key',
  'title',
  'subtitle',
  'author_name',
  'first_publish_year',
  'isbn',
  'cover_i',
  'number_of_pages_median',
  'language',
  'subject',
].join(',');

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  language?: string[];
  subject?: string[];
}

interface OpenLibraryResponse {
  docs?: OpenLibraryDoc[];
}

/** Маппинг трёхбуквенных кодов языка OpenLibrary в двухбуквенные. */
const LANG_MAP: Record<string, string> = {
  rus: 'ru',
  eng: 'en',
  ger: 'de',
  fre: 'fr',
  spa: 'es',
  ita: 'it',
};

function pickIsbns(list: string[] | undefined): {
  isbn13: string | null;
  isbn10: string | null;
} {
  let isbn13: string | null = null;
  let isbn10: string | null = null;
  for (const raw of list ?? []) {
    const cleaned = cleanIsbn(raw);
    if (!isbn13 && isValidIsbn13(cleaned)) isbn13 = cleaned;
    if (!isbn10 && isValidIsbn10(cleaned)) isbn10 = cleaned;
  }
  return { isbn13, isbn10 };
}

function normalizeDoc(doc: OpenLibraryDoc): NormalizedBook | null {
  if (!doc.title || !doc.key) return null;
  const { isbn13, isbn10 } = pickIsbns(doc.isbn);
  const langCode = doc.language?.[0];

  return {
    source: 'openlibrary',
    sourceId: doc.key,
    isbn13,
    isbn10,
    title: doc.title,
    subtitle: doc.subtitle ?? null,
    authors: doc.author_name ?? [],
    description: null, // подробное описание — отдельным запросом на /works/{key}.json
    coverUrl: doc.cover_i ? `${COVER_BASE}/id/${doc.cover_i}-M.jpg` : null,
    pageCount: doc.number_of_pages_median ?? null,
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
    language: langCode ? (LANG_MAP[langCode] ?? langCode) : null,
    genres: (doc.subject ?? []).slice(0, 8),
    mediaType: 'book',
  };
}

/**
 * Ищет книги в OpenLibrary.
 * @param query   свободный текст или ISBN
 * @param options isbn — поиск строго по ISBN; signal — для тайм-аута
 */
export async function searchOpenLibrary(
  query: string,
  options: { isbn?: boolean; signal?: AbortSignal; limit?: number } = {},
): Promise<NormalizedBook[]> {
  const { isbn = false, signal, limit = 20 } = options;

  const url = new URL(SEARCH_ENDPOINT);
  if (isbn) {
    url.searchParams.set('isbn', cleanIsbn(query));
  } else {
    url.searchParams.set('q', query);
  }
  url.searchParams.set('limit', String(Math.min(limit, 50)));
  url.searchParams.set('fields', FIELDS);

  const res = await fetch(url, {
    signal,
    headers: { 'User-Agent': 'KnizhnayaPolka/0.1 (book tracker)' },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`OpenLibrary вернул ${res.status}`);
  }

  const data = (await res.json()) as OpenLibraryResponse;
  return (data.docs ?? [])
    .map(normalizeDoc)
    .filter((b): b is NormalizedBook => b !== null);
}
