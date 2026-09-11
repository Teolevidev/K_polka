'use server';

import { revalidatePath } from 'next/cache';
import { getAdminContext } from '@/lib/admin/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { enqueueMany, type EnqueueInput } from './jobs';
import { parseBookList } from './parse';
import type { ContentJobKind } from './types';

/**
 * Действия админки над очередью агента.
 *
 * Каждое начинается с проверки роли: модуль jobs ходит с service_role
 * и RLS ему не указ, поэтому единственная защита - вот эта строчка.
 * Забыть ее здесь значит открыть очередь всем подряд.
 */

export interface ContentActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/** Ставит в очередь список книг: по строке на книгу. */
export async function queueBooks(raw: string): Promise<ContentActionResult> {
  const admin = await getAdminContext();
  if (!admin || admin.role !== 'admin') {
    return { ok: false, error: 'Доступ только для администратора' };
  }

  const inputs: EnqueueInput[] = parseBookList(raw).map((parsed) => ({
    kind: 'ingest_book' as ContentJobKind,
    payload: parsed.payload,
    dedupeKey: `ingest:${parsed.key}`,
    createdBy: admin.userId,
  }));

  if (inputs.length === 0) {
    return { ok: false, error: 'Список пуст: по книге на строку' };
  }

  const res = await enqueueMany(inputs, createSupabaseAdminClient());
  revalidatePath('/admin/content');

  if (res.errors.length > 0) {
    return { ok: false, error: res.errors[0] };
  }
  return {
    ok: true,
    message:
      `Поставлено: ${res.queued}` +
      (res.duplicates > 0 ? `, пропущено повторов: ${res.duplicates}` : ''),
  };
}

/** Ставит одно текстовое задание. */
export async function queueText(
  kind: 'review' | 'longread' | 'roundup',
  value: string,
): Promise<ContentActionResult> {
  const admin = await getAdminContext();
  if (!admin || admin.role !== 'admin') {
    return { ok: false, error: 'Доступ только для администратора' };
  }

  const text = value.trim();
  if (!text) return { ok: false, error: 'Пустое задание' };

  const payload =
    kind === 'review'
      ? { bookId: text }
      : kind === 'longread'
        ? { topic: text }
        : { theme: text };

  // Рецензия на книгу нужна одна - ключ повтора держит это правило.
  const dedupeKey = kind === 'review' ? `review:${text}` : null;

  const res = await enqueueMany(
    [{ kind, payload, dedupeKey, createdBy: admin.userId }],
    createSupabaseAdminClient(),
  );
  revalidatePath('/admin/content');

  if (res.errors.length > 0) return { ok: false, error: res.errors[0] };
  if (res.duplicates > 0) {
    return { ok: true, message: 'Такое задание уже стоит в очереди' };
  }
  return { ok: true, message: 'Задание поставлено' };
}

/** Возвращает упавшее задание в очередь. */
export async function retryJob(id: string): Promise<ContentActionResult> {
  const admin = await getAdminContext();
  if (!admin || admin.role !== 'admin') {
    return { ok: false, error: 'Доступ только для администратора' };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('content_jobs')
    .update({
      status: 'queued',
      attempts: 0,
      error: null,
      run_after: new Date().toISOString(),
      finished_at: null,
    })
    .eq('id', id);

  revalidatePath('/admin/content');
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Снимает задание с очереди. */
export async function cancelJob(id: string): Promise<ContentActionResult> {
  const admin = await getAdminContext();
  if (!admin || admin.role !== 'admin') {
    return { ok: false, error: 'Доступ только для администратора' };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('content_jobs')
    .update({ status: 'cancelled', finished_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath('/admin/content');
  return error ? { ok: false, error: error.message } : { ok: true };
}
