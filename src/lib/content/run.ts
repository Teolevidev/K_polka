import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { claimJob, completeJob, failJob } from './jobs';
import { runIngestBook } from './ingest';
import { runLongread, runReview, runRoundup } from './write';
import type {
  ContentJob,
  ContentJobResult,
  IngestBookPayload,
  LongreadPayload,
  ReviewPayload,
  RoundupPayload,
} from './types';

/**
 * Прогон очереди.
 *
 * Одна функция на оба способа запуска: крон зовет ее с маленьким
 * лимитом (функция на Vercel живет ограниченное время), а ручной
 * скрипт - с большим. Разного кода для «по расписанию» и «руками» нет,
 * иначе одно из двух неизбежно отстанет от другого.
 */

export interface RunReport {
  processed: number;
  done: number;
  failed: number;
  items: {
    id: string;
    kind: string;
    ok: boolean;
    summary?: string;
    error?: string;
    warnings?: string[];
  }[];
}

/** Выполняет одно задание. Бросает исключение - значит, не вышло. */
async function dispatch(job: ContentJob): Promise<ContentJobResult> {
  const supabase = createSupabaseAdminClient();

  switch (job.kind) {
    // payload в базе лежит как jsonb, то есть вообще без типа. Здесь
    // он впервые обретает форму, и проверяют ее сами обработчики:
    // «в задании не указана книга» - обычная ошибка задания, а не сбой.
    case 'ingest_book':
      return runIngestBook(job.payload as unknown as IngestBookPayload, supabase);
    case 'review':
      return runReview(job.payload as unknown as ReviewPayload, supabase);
    case 'longread':
      return runLongread(job.payload as unknown as LongreadPayload, supabase);
    case 'roundup':
      return runRoundup(job.payload as unknown as RoundupPayload, supabase);
    default:
      throw new Error(`Неизвестный вид задания: ${job.kind}`);
  }
}

export interface RunOptions {
  /** Сколько заданий взять за прогон. */
  limit?: number;
  /**
   * Крайний срок в миллисекундах. Крон останавливается заранее, не
   * дожидаясь, пока платформа убьет функцию посреди записи в базу.
   */
  budgetMs?: number;
}

/** Берет задания одно за другим, пока они есть и есть время. */
export async function runContentJobs(options: RunOptions = {}): Promise<RunReport> {
  const limit = options.limit ?? 1;
  const budgetMs = options.budgetMs ?? Number.POSITIVE_INFINITY;
  const startedAt = Date.now();

  const report: RunReport = { processed: 0, done: 0, failed: 0, items: [] };

  while (report.processed < limit && Date.now() - startedAt < budgetMs) {
    const job = await claimJob();
    if (!job) break;

    report.processed += 1;
    try {
      const result = await dispatch(job);
      await completeJob(job.id, result);
      report.done += 1;
      report.items.push({
        id: job.id,
        kind: job.kind,
        ok: true,
        summary: result.summary,
        warnings: result.warnings,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await failJob(job, message);
      report.failed += 1;
      report.items.push({ id: job.id, kind: job.kind, ok: false, error: message });
    }
  }

  return report;
}
