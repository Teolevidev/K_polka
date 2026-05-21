import type {
  NormalizedBook,
  SearchResultBook,
  BookSource,
  BookSearchResponse,
} from './types';
import { detectQueryKind } from './isbn';
import { normalizeText, fuzzyScore } from './normalize';
import { searchGoogleBooks } from './google';
import { searchOpenLibrary } from './openlibrary';

/**
 * Федеративный поиск книг.
 *
 * Стратегия:
 *  1. Параллельно опрашиваем источники с тайм-аутом.
 *  2. Дедуплицируем результаты (по ISBN-13, затем по «название + автор»).
 *  3. Скорим каждый результат через fuzzy-сопоставление с запросом
 *     (терпимо к опечаткам в авторе/названии).
 *  4. Сортируем по score, при равенстве — по числу подтвердивших источников.
 */

const SOURCE_TIMEOUT_MS = 6000;

/** Ключ дедупликации книги. */
function dedupeKey(book: NormalizedBook): string {
  if (book.isbn13) return `isbn:${book.isbn13}`;
  const title = normalizeText(book.title);
  const author = normalizeText(book.authors[0] ?? '');
  return `ta:${title}|${author}`;
}

/** Сливает две версии одной книги, выбирая более полные поля. */
function mergeBooks(a: NormalizedBook, b: NormalizedBook): NormalizedBook {
  const longer = (x: string | null, y: string | null) =>
    (x?.length ?? 0) >= (y?.length ?? 0) ? x : y;

  return {
    ...a,
    isbn13: a.isbn13 ?? b.isbn13,
    isbn10: a.isbn10 ?? b.isbn10,
    subtitle: a.subtitle ?? b.subtitle,
    description: longer(a.description, b.description),
    coverUrl: a.coverUrl ?? b.coverUrl,
    pageCount: a.pageCount ?? b.pageCount,
    publishedDate: a.publishedDate ?? b.publishedDate,
    language: a.language ?? b.language,
    authors: a.authors.length >= b.authors.length ? a.authors : b.authors,
    genres: Array.from(new Set([...a.genres, ...b.genres])),
  };
}

/** Запускает источник с тайм-аутом; при ошибке возвращает пустой результат. */
async function runSource(
  name: BookSource,
  fn: (signal: AbortSignal) => Promise<NormalizedBook[]>,
): Promise<{ source: BookSource; books: NormalizedBook[]; ok: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    const books = await fn(controller.signal);
    return { source: name, books, ok: true };
  } catch {
    return { source: name, books: [], ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Скор книги относительно запроса: лучшее из совпадений по названию и автору. */
function scoreBook(book: NormalizedBook, query: string): number {
  const titleText = [book.title, book.subtitle].filter(Boolean).join(' ');
  const titleScore = fuzzyScore(query, titleText);
  const authorScore = book.authors.length
    ? Math.max(...book.authors.map((a) => fuzzyScore(query, a)))
    : 0;
  // Название важнее автора; комбинируем с приоритетом названия.
  return Math.max(titleScore, authorScore * 0.85);
}

export async function searchBooks(rawQuery: string): Promise<BookSearchResponse> {
  const query = rawQuery.trim();
  if (query.length < 2) {
    return { query, results: [], respondedSources: [], failedSources: [] };
  }

  const kind = detectQueryKind(query);
  const isbn = kind === 'isbn';

  // ISBNdb и LiveLib подключаются в следующих итерациях Фазы 1.
  const sourceResults = await Promise.all([
    runSource('google', (signal) =>
      searchGoogleBooks(query, { isbn, signal, limit: 24 }),
    ),
    runSource('openlibrary', (signal) =>
      searchOpenLibrary(query, { isbn, signal, limit: 24 }),
    ),
  ]);

  const respondedSources: BookSource[] = [];
  const failedSources: BookSource[] = [];
  for (const r of sourceResults) {
    (r.ok ? respondedSources : failedSources).push(r.source);
  }

  // Дедупликация со слиянием
  const merged = new Map<string, { book: NormalizedBook; sources: Set<BookSource> }>();
  for (const result of sourceResults) {
    for (const book of result.books) {
      const key = dedupeKey(book);
      const existing = merged.get(key);
      if (existing) {
        existing.book = mergeBooks(existing.book, book);
        existing.sources.add(book.source);
      } else {
        merged.set(key, { book, sources: new Set([book.source]) });
      }
    }
  }

  // Скоринг и сортировка
  const results: SearchResultBook[] = Array.from(merged.values())
    .map(({ book, sources }) => ({
      ...book,
      score: isbn ? 1 : scoreBook(book, query),
      sources: Array.from(sources),
    }))
    .filter((b) => isbn || b.score >= 0.3)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.sources.length !== a.sources.length) {
        return b.sources.length - a.sources.length;
      }
      // при равенстве отдаём приоритет книгам с обложкой
      return (b.coverUrl ? 1 : 0) - (a.coverUrl ? 1 : 0);
    })
    .slice(0, 40);

  return { query, results, respondedSources, failedSources };
}
