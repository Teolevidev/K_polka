import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  rowToJob,
  type ContentJob,
  type ContentJobKind,
  type ContentJobResult,
} from './types';

/**
 * Очередь заданий контент-агента.
 *
 * Все операции идут через service_role: агент работает без пользователя
 * и RLS ему не поможет, а помешает. Отсюда же и единственное правило
 * безопасности этого модуля - его нельзя звать из кода, который
 * выполняется по запросу постороннего. Точки входа ровно две: крон с
 * секретом и админка с проверкой роли.
 */

/** Выдержка перед повторной попыткой: 5 минут, потом 25, потом 125. */
const RETRY_BASE_MINUTES = 5;

export interface EnqueueInput {
  kind: ContentJobKind;
  payload: Record<string, unknown>;
  /**
   * Ключ повтора. Если задание с таким ключом уже стоит в очереди или
   * выполнено, второй раз оно не встанет. Для книг это ISBN, для
   * текстов - идентификатор книги вместе с видом задания.
   */
  dedupeKey?: string | null;
  createdBy?: string | null;
  /** Отложить старт: ISO-время. */
  runAfter?: string;
}

export interface EnqueueResult {
  ok: boolean;
  id?: string;
  /** Задание с таким dedupeKey уже было - это не ошибка. */
  duplicate?: boolean;
  error?: string;
}

/** Ставит задание в очередь. Повтор по dedupeKey молча пропускается. */
export async function enqueueJob(
  input: EnqueueInput,
  client?: SupabaseClient,
): Promise<EnqueueResult> {
  const supabase = client ?? createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('content_jobs')
    .insert({
      kind: input.kind,
      payload: input.payload,
      dedupe_key: input.dedupeKey ?? null,
      created_by: input.createdBy ?? null,
      run_after: input.runAfter ?? new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    // 23505 - нарушение уникальности dedupe_key. Ровно то, ради чего
    // ключ и заведен: задание уже стоит, второе не нужно.
    if (error.code === '23505') return { ok: true, duplicate: true };
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as string };
}

/** Ставит пачку заданий. Возвращает, сколько встало и сколько было повторов. */
export async function enqueueMany(
  inputs: EnqueueInput[],
  client?: SupabaseClient,
): Promise<{ queued: number; duplicates: number; errors: string[] }> {
  const supabase = client ?? createSupabaseAdminClient();
  let queued = 0;
  let duplicates = 0;
  const errors: string[] = [];

  // По одному, а не одним insert: пачка падает целиком из-за единственного
  // повтора, и тогда непонятно, что встало, а что нет.
  for (const input of inputs) {
    const res = await enqueueJob(input, supabase);
    if (!res.ok) errors.push(res.error ?? 'неизвестная ошибка');
    else if (res.duplicate) duplicates += 1;
    else queued += 1;
  }

  return { queued, duplicates, errors };
}

/**
 * Берет очередное задание и переводит его в работу.
 *
 * Вся логика выборки - в SQL-функции claim_content_job: только там
 * можно сделать `for update skip locked`, а без него два одновременных
 * прогона возьмут одно задание дважды.
 */
export async function claimJob(client?: SupabaseClient): Promise<ContentJob | null> {
  const supabase = client ?? createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('claim_content_job');
  if (error) throw new Error(`Не удалось взять задание: ${error.message}`);
  if (!data) return null;
  // Функция объявлена returns content_jobs - postgrest отдает объект.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return rowToJob(row as Record<string, unknown>);
}

/** Отмечает задание выполненным. */
export async function completeJob(
  id: string,
  result: ContentJobResult,
  client?: SupabaseClient,
): Promise<void> {
  const supabase = client ?? createSupabaseAdminClient();
  await supabase
    .from('content_jobs')
    .update({
      status: 'done',
      result,
      error: null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', id);
}

/**
 * Отмечает неудачу.
 *
 * Пока попытки не исчерпаны, задание возвращается в очередь с отсрочкой:
 * внешний источник мог быть недоступен минуту, и вторая попытка через
 * пять минут пройдет. Когда попытки кончились - задание остается
 * failed и ждет человека в админке.
 */
export async function failJob(
  job: ContentJob,
  message: string,
  client?: SupabaseClient,
): Promise<void> {
  const supabase = client ?? createSupabaseAdminClient();
  const exhausted = job.attempts >= job.maxAttempts;

  const delayMinutes = RETRY_BASE_MINUTES * Math.pow(5, job.attempts - 1);
  const runAfter = new Date(Date.now() + delayMinutes * 60_000).toISOString();

  await supabase
    .from('content_jobs')
    .update({
      status: exhausted ? 'failed' : 'queued',
      error: message.slice(0, 2000),
      run_after: exhausted ? job.runAfter : runAfter,
      finished_at: exhausted ? new Date().toISOString() : null,
    })
    .eq('id', job.id);
}

/** Список заданий для админки, свежие сверху. */
export async function listJobs(
  limit = 50,
  client?: SupabaseClient,
): Promise<ContentJob[]> {
  const supabase = client ?? createSupabaseAdminClient();
  const { data } = await supabase
    .from('content_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return ((data ?? []) as Record<string, unknown>[]).map(rowToJob);
}

/** Сводка по очереди: сколько чего ждет. */
export async function countByStatus(
  client?: SupabaseClient,
): Promise<Record<string, number>> {
  const supabase = client ?? createSupabaseAdminClient();
  const { data } = await supabase.from('content_jobs').select('status');
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { status: string }[]) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}
