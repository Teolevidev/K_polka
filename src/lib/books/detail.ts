import type { NormalizedBook } from './types';
import type { BookRef } from './ref';
import { cleanIsbn } from './isbn';

/**
 * Получение одной книги по ссылке источника — для страницы книги.
 * Поддерживает Google Books (полные данные) и OpenLibrary (work + авторы).
 */

/**
 * Источник не смог ответить: исчерпана квота, сбой на их стороне,
 * сеть не дошла.
 *
 * Отличать это от «книги нет» важно: раньше любая такая осечка
 * превращалась в страницу «Книга не найдена», хотя книга существует и
 * ссылка верная. Человек видел «ссылка устарела» и не понимал, почему
 * поиск книгу показывает, а открыть её нельзя.
 */
export class SourceUnavailableError extends Error {
  constructor(
    readonly source: string,
    readonly status: number,
  ) {
    super(`Источник ${source} ответил ${status}`);
    this.name = 'SourceUnavailableError';
  }
}

/**
 * Ответ говорит о временной беде источника, а не об отсутствии книги.
 * 404 и 410 — книги действительно нет. Остальное (429 — квота,
 * 5xx — сбой, 403 — доступ) заслуживает честного сообщения.
 */
export function isTransientStatus(status: number): boolean {
  return status !== 404 && status !== 410;
}

interface GoogleVolumeFull {
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
    imageLinks?: { thumbnail?: string; medium?: string; large?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
  };
}

async function getGoogleBook(id: string): Promise<NormalizedBook | null> {
  const url = new URL(`https://www.googleapis.com/books/v1/volumes/${id}`);
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    url.searchParams.set('key', process.env.GOOGLE_BOOKS_API_KEY);
  }
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) {
    if (isTransientStatus(res.status)) {
      throw new SourceUnavailableError('Google Books', res.status);
    }
    return null;
  }

  const v = (await res.json()) as GoogleVolumeFull;
  const info = v.volumeInfo;
  if (!info?.title) return null;

  const ids = info.industryIdentifiers ?? [];
  const isbn13 = ids.find((i) => i.type === 'ISBN_13')?.identifier ?? null;
  const isbn10 = ids.find((i) => i.type === 'ISBN_10')?.identifier ?? null;
  const cover = (
    info.imageLinks?.large ??
    info.imageLinks?.medium ??
    info.imageLinks?.thumbnail ??
    ''
  ).replace(/^http:/, 'https:');

  return {
    source: 'google',
    sourceId: v.id,
    isbn13: isbn13 ? cleanIsbn(isbn13) : null,
    isbn10: isbn10 ? cleanIsbn(isbn10) : null,
    title: info.title,
    subtitle: info.subtitle ?? null,
    authors: info.authors ?? [],
    description: info.description ?? null,
    coverUrl: cover || null,
    pageCount: info.pageCount ?? null,
    publishedDate: info.publishedDate ?? null,
    language: info.language ?? null,
    genres: info.categories ?? [],
    mediaType: 'book',
  };
}

interface OpenLibraryWork {
  title?: string;
  description?: string | { value?: string };
  covers?: number[];
  subjects?: string[];
  authors?: { author?: { key?: string } }[];
}

async function getOpenLibraryBook(key: string): Promise<NormalizedBook | null> {
  // key вида "/works/OL123W"
  const workPath = key.startsWith('/') ? key : `/${key}`;
  const res = await fetch(`https://openlibrary.org${workPath}.json`, {
    headers: { 'User-Agent': 'KnizhnayaPolka/0.1 (book tracker)' },
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    if (isTransientStatus(res.status)) {
      throw new SourceUnavailableError('OpenLibrary', res.status);
    }
    return null;
  }

  const work = (await res.json()) as OpenLibraryWork;
  if (!work.title) return null;

  // Авторы — отдельными запросами по ключам
  const authorKeys = (work.authors ?? [])
    .map((a) => a.author?.key)
    .filter((k): k is string => Boolean(k))
    .slice(0, 5);
  const authors = await Promise.all(
    authorKeys.map(async (k) => {
      try {
        const r = await fetch(`https://openlibrary.org${k}.json`, {
          headers: { 'User-Agent': 'KnizhnayaPolka/0.1 (book tracker)' },
          next: { revalidate: 86400 },
        });
        if (!r.ok) return null;
        const a = (await r.json()) as { name?: string };
        return a.name ?? null;
      } catch {
        return null;
      }
    }),
  );

  const description =
    typeof work.description === 'string'
      ? work.description
      : (work.description?.value ?? null);

  return {
    source: 'openlibrary',
    sourceId: key,
    isbn13: null,
    isbn10: null,
    title: work.title,
    subtitle: null,
    authors: authors.filter((a): a is string => Boolean(a)),
    description,
    coverUrl: work.covers?.[0]
      ? `https://covers.openlibrary.org/b/id/${work.covers[0]}-L.jpg`
      : null,
    pageCount: null,
    publishedDate: null,
    language: null,
    genres: (work.subjects ?? []).slice(0, 8),
    mediaType: 'book',
  };
}

/**
 * Получает книгу по ссылке источника.
 *
 * Бросает SourceUnavailableError, если источник не ответил: вызывающая
 * сторона должна показать «источник недоступен», а не «книга не найдена».
 * Возвращает null только когда книги действительно нет.
 */
export async function getBookByRef(ref: BookRef): Promise<NormalizedBook | null> {
  try {
    switch (ref.source) {
      case 'google':
        return await getGoogleBook(ref.sourceId);
      case 'openlibrary':
        return await getOpenLibraryBook(ref.sourceId);
      default:
        return null;
    }
  } catch (error) {
    if (error instanceof SourceUnavailableError) throw error;
    // Сеть не дошла или ответ не разобрался — это тоже не «книги нет».
    throw new SourceUnavailableError(ref.source, 0);
  }
}
