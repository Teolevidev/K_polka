'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { decodeBookRef } from '@/lib/books/ref';
import { getBookByRef } from '@/lib/books/detail';
import { findOrCreateBook } from '@/lib/books/catalog';

export type ShelfStatus = 'reading' | 'read' | 'want';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Добавляет книгу (по ссылке источника) на полку пользователя.
 * Книга при необходимости заводится в каталоге.
 */
export async function addBookToShelf(
  ref: string,
  status: ShelfStatus,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };

  const decoded = decodeBookRef(ref);
  if (!decoded) return { ok: false, error: 'Некорректная ссылка на книгу' };

  const book = await getBookByRef(decoded);
  if (!book) return { ok: false, error: 'Книга не найдена' };

  const supabase = await createSupabaseServerClient();

  try {
    const bookId = await findOrCreateBook(supabase, book);

    const { error } = await supabase.from('user_books').upsert(
      {
        user_id: user.id,
        book_id: bookId,
        status,
        started_at: status === 'reading' ? today() : null,
        finished_at: status === 'read' ? today() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,book_id' },
    );
    if (error) throw error;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка' };
  }

  revalidatePath('/library');
  revalidatePath('/profile');
  revalidatePath(`/book/${ref}`);
  return { ok: true };
}

/** Меняет статус книги, уже добавленной на полку (по UUID книги). */
export async function setShelfStatus(
  bookId: string,
  status: ShelfStatus,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('user_books')
    .update({
      status,
      finished_at: status === 'read' ? today() : null,
      started_at: status === 'reading' ? today() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('book_id', bookId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/library');
  revalidatePath('/profile');
  return { ok: true };
}

/** Убирает книгу с полки. */
export async function removeBookFromShelf(bookId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('user_books')
    .delete()
    .eq('user_id', user.id)
    .eq('book_id', bookId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/library');
  revalidatePath('/profile');
  return { ok: true };
}

/** Ставит оценку книге (1..10). */
export async function setBookRating(
  bookId: string,
  rating: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };
  if (rating < 1 || rating > 10) return { ok: false, error: 'Оценка 1–10' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('user_books')
    .update({ rating, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('book_id', bookId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/library');
  revalidatePath('/profile');
  return { ok: true };
}

/** Устанавливает годовую цель по числу книг. */
export async function setReadingGoal(target: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };
  if (target < 1 || target > 1000) return { ok: false, error: 'Цель 1–1000 книг' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      reading_goal_year: new Date().getFullYear(),
      reading_goal_target: target,
      reading_goal_set_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/profile');
  revalidatePath('/');
  return { ok: true };
}
