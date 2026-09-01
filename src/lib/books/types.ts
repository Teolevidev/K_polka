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
  /**
   * Оценка из внешнего источника по шкале 1–5.
   *
   * Важно: у нас своя шкала 1–10, смешивать их нельзя. Это вспомогательный
   * сигнал для книг, которые в клубе ещё никто не оценил, и показывать его
   * нужно отдельно и с явной подписью, чей это рейтинг.
   */
  externalRating?: { average: number; count: number } | null;
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
  /**
   * Выдача сокращена до названий на алфавите запроса: по русскому запросу
   * показаны только русские названия. Ложь, если фильтровать было нечего
   * или пришлось показать всё, чтобы не оставить человека ни с чем.
   */
  filteredByScript: boolean;
  /** Сколько результатов скрыто фильтром по алфавиту. */
  hiddenByScript: number;
}

/** Тип запроса, определяемый эвристикой по строке поиска. */
export type QueryKind = 'isbn' | 'free-text';
