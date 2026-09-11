/**
 * Контент-агент: типы заданий.
 *
 * Агент наполняет сайт по заданиям из очереди content_jobs. Задание -
 * это kind плюс payload, и разбирается оно здесь, в одном месте: в БД
 * payload лежит как jsonb, то есть без всякой типизации.
 */

export type ContentJobKind = 'ingest_book' | 'review' | 'longread' | 'roundup';

export type ContentJobStatus =
  | 'queued'
  | 'running'
  | 'done'
  | 'failed'
  | 'cancelled';

/**
 * Завести книгу в каталог.
 *
 * Хватает любого из трех входов. ISBN точнее всего: по нему Google
 * отдает конкретное издание, а не похожие. Название с автором - для
 * случая, когда ISBN под рукой нет.
 */
export interface IngestBookPayload {
  isbn?: string;
  title?: string;
  author?: string;
  /** Свободный запрос, если ни ISBN, ни пары «название + автор» нет. */
  query?: string;
}

/** Редакционная рецензия на книгу из каталога. */
export interface ReviewPayload {
  /** UUID книги в нашем каталоге. */
  bookId?: string;
  /** Либо ссылка источника - тогда книга сначала заводится в каталог. */
  bookRef?: string;
  /** Угол зрения: «для тех, кто не любит фантастику», «спустя 40 лет». */
  angle?: string;
}

/** Лонгрид по теме. Может опираться на несколько книг каталога. */
export interface LongreadPayload {
  topic: string;
  /** UUID книг каталога, о которых идет речь. */
  bookIds?: string[];
  angle?: string;
}

/** Подборка из книг, которые уже есть в каталоге. */
export interface RoundupPayload {
  theme: string;
  /** Сколько книг взять в подборку. По умолчанию 5. */
  limit?: number;
}

export type ContentJobPayload =
  | IngestBookPayload
  | ReviewPayload
  | LongreadPayload
  | RoundupPayload;

export interface ContentJob {
  id: string;
  kind: ContentJobKind;
  payload: Record<string, unknown>;
  status: ContentJobStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  dedupeKey: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

/** Что задание оставило после себя - кладется в content_jobs.result. */
export interface ContentJobResult {
  /** Человекочитаемая строка для админки: «Завел книгу ...». */
  summary: string;
  bookId?: string;
  articleId?: string;
  slug?: string;
  /** Замечания, которые не отменяют результат, но стоят внимания. */
  warnings?: string[];
}

/** Приводит строку таблицы к типу ContentJob. */
export function rowToJob(row: Record<string, unknown>): ContentJob {
  return {
    id: row.id as string,
    kind: row.kind as ContentJobKind,
    payload: (row.payload as Record<string, unknown>) ?? {},
    status: row.status as ContentJobStatus,
    result: (row.result as Record<string, unknown> | null) ?? null,
    error: (row.error as string | null) ?? null,
    attempts: (row.attempts as number) ?? 0,
    maxAttempts: (row.max_attempts as number) ?? 3,
    runAfter: row.run_after as string,
    dedupeKey: (row.dedupe_key as string | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    finishedAt: (row.finished_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Подпись задания для админки и логов. */
export const JOB_KIND_LABEL: Record<ContentJobKind, string> = {
  ingest_book: 'Книга в каталог',
  review: 'Рецензия',
  longread: 'Лонгрид',
  roundup: 'Подборка',
};
