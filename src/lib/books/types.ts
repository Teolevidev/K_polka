/**
 * Доменные типы для книг.
 * NormalizedBook — единый формат, к которому приводятся данные из всех
 * внешних источников (Google Books, OpenLibrary, ISBNdb, LiveLib).
 */

export type BookSource = 'google' | 'openlibrary' | 'isbndb' | 'livelib' | 'local';

export type MediaType = 'book' | 'audiobook' | 'comic';

export interface NormalizedBook {
  /** Источник, из которого пришли данные. */
  source: BookSource;
  /** Идентификатор книги в источнике. */
  sourceId: string;
  isbn13: string | null;
  isbn10: string | null;
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  coverUrl: string | null;
  pageCount: number | null;
  /** Год или ISO-дата издания в виде строки. */
  publishedDate: string | null;
  /** Код языка: 'ru', 'en', … */
  language: string | null;
  genres: string[];
  mediaType: MediaType;
  /**
   * Кол-во известных изданий книги (signal каноничности).
   * OpenLibrary возвращает в поле edition_count; Google Books — нет.
   */
  editionCount?: number;
  /**
   * Идентификатор произведения (work) в OpenLibrary, вида `/works/OL…W`.
   * Объединяет все издания и переводы одной книги. Заполняет только
   * OpenLibrary: у Google Books понятия work нет.
   */
  workId?: string | null;
  /**
   * ISBN изданий этого произведения — мост между work и изданиями
   * Google Books, у которых своего work-идентификатора нет.
   * Заполняет только OpenLibrary.
   */
  editionIsbns?: string[];
}

export interface SearchResultBook extends NormalizedBook {
  /** Релевантность 0..1 — насколько результат соответствует запросу. */
  score: number;
  /** Все источники, подтвердившие книгу (после дедупликации). */
  sources: BookSource[];
}

export interface BookSearchResponse {
  query: string;
  results: SearchResultBook[];
  /** Источники, ответившие на запрос (для диагностики). */
  respondedSources: BookSource[];
  /** Источники, не ответившие вовремя. */
  failedSources: BookSource[];
}

/** Тип запроса, определяемый эвристикой по строке поиска. */
export type QueryKind = 'isbn' | 'free-text';
