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
  /** Издательство, если источник его знает. */
  publisher?: string | null;
  /** Страница книги в источнике - «посмотреть в Google Books». */
  sourceUrl?: string | null;
  /**
   * Идентификатор тома в Google Books.
   *
   * Нужен книгам из своего каталога: по нему обложка собирается заново
   * в нужном размере, вместо того чтобы хранить готовую ссылку с уже
   * зашитым размером.
   */
  googleVolumeId?: string | null;
  /** Бумажная книга, электронная, журнал. */
  printType?: string | null;
  /** Что с книгой можно сделать: почитать, скачать, купить. */
  availability?: BookAvailability | null;
  /** Серия, если издание в нее входит. */
  series?: BookSeries | null;
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

/**
 * Что с книгой можно сделать прямо сейчас: почитать, скачать, купить.
 *
 * На сайте Google это вкладка «Получить книгу». В API те же данные
 * лежат в saleInfo и accessInfo - двух блоках, которые мы раньше не
 * читали вовсе.
 */
export interface BookAvailability {
  /** Насколько доступен предпросмотр: никак, фрагмент, целиком. */
  preview: 'none' | 'partial' | 'full';
  /** Есть ли электронное издание. */
  isEbook: boolean;
  /** Общественное достояние - можно читать и скачивать свободно. */
  publicDomain: boolean;
  epub: boolean;
  pdf: boolean;
  /** Ссылка на читалку Google. */
  readerUrl: string | null;
  /** Ссылка на покупку. */
  buyUrl: string | null;
  price: { amount: number; currency: string } | null;
}

/** Книга в серии: «Дозоры», книга 3. */
export interface BookSeries {
  title: string | null;
  number: number | null;
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
   * Источники, которые не настроены: например, не задан ключ Google.
   * Отделено от failedSources намеренно - «мы не настроили» и «у них
   * сбой» чинятся совершенно по-разному.
   */
  misconfiguredSources: BookSource[];
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
