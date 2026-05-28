'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/auth';
import { decodeBookRef } from '@/lib/books/ref';
import { getBookByRef } from '@/lib/books/detail';
import { rotateEditorialPicks } from './queries';
import { mondayOf } from './week';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Админ отмечает книгу как «Выбор администратора». */
export async function markEditorialPick(bookRef: string): Promise<ActionResult> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: 'Доступ только для администратора' };

  const decoded = decodeBookRef(bookRef);
  if (!decoded) return { ok: false, error: 'Некорректная ссылка на книгу' };

  const book = await getBookByRef(decoded);
  if (!book) return { ok: false, error: 'Книга не найдена' };

  const supabase = await createSupabaseServerClient();
  // Уже отмечена? Не дублируем.
  const { data: existing } = await supabase
    .from('editorial_picks')
    .select('id')
    .eq('book_ref', bookRef)
    .maybeSingle();
  if (existing?.id) {
    return { ok: false, error: 'Книга уже в подборке' };
  }

  const { error } = await supabase.from('editorial_picks').insert({
    book_ref: bookRef,
    title: book.title,
    authors: book.authors.join(', '),
    cover_url: book.coverUrl,
    marked_by: admin.userId,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/editorial');
  revalidatePath('/');
  return { ok: true };
}

/** Снимает признак «Выбор администратора» с книги (удаляет запись). */
export async function unmarkEditorialPick(pickId: string): Promise<ActionResult> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: 'Доступ только для администратора' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('editorial_picks').delete().eq('id', pickId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/editorial');
  revalidatePath('/');
  return { ok: true };
}

/** Принудительно обновить пятёрку на эту неделю (вручную, из админки). */
export async function rotateNow(): Promise<ActionResult & { count?: number }> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: 'Доступ только для администратора' };

  try {
    const count = await rotateEditorialPicks(mondayOf(), 5);
    revalidatePath('/admin/editorial');
    revalidatePath('/');
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка ротации' };
  }
}
