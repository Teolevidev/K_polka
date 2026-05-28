'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { decodeBookRef } from '@/lib/books/ref';
import { getBookByRef } from '@/lib/books/detail';
import { findOrCreateBook } from '@/lib/books/catalog';
import { getAdminContext } from '@/lib/admin/auth';
import { recomputeAchievements } from '@/lib/achievements/recompute';
import type { ModerationStatus } from './queries';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface SubmitReviewInput {
  bookRef: string;
  body: string;
  rating: number | null;
  spoiler: boolean;
}

/** Создаёт или обновляет отзыв пользователя на книгу. */
export async function submitReview(input: SubmitReviewInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };

  const body = input.body.trim();
  if (body.length < 5) return { ok: false, error: 'Отзыв слишком короткий' };
  if (body.length > 10000) return { ok: false, error: 'Отзыв слишком длинный' };
  if (input.rating !== null && (input.rating < 1 || input.rating > 10)) {
    return { ok: false, error: 'Оценка должна быть от 1 до 10' };
  }

  const decoded = decodeBookRef(input.bookRef);
  if (!decoded) return { ok: false, error: 'Некорректная ссылка на книгу' };

  const book = await getBookByRef(decoded);
  if (!book) return { ok: false, error: 'Книга не найдена' };

  const supabase = await createSupabaseServerClient();
  try {
    const bookId = await findOrCreateBook(supabase, book);

    const { error } = await supabase.from('reviews').upsert(
      {
        user_id: user.id,
        book_id: bookId,
        body,
        rating: input.rating,
        spoiler: input.spoiler,
        visibility: 'public',
        // moderation_status оставляем без значения (default 'visible'),
        // чтобы не сбрасывать ручной статус при редактировании.
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,book_id' },
    );
    if (error) throw error;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка' };
  }

  await recomputeAchievements(user.id).catch(() => {});
  revalidatePath(`/book/${input.bookRef}`);
  revalidatePath('/profile');
  revalidatePath('/profile/reviews');
  return { ok: true };
}

/** Удаляет собственный отзыв. */
export async function deleteOwnReview(reviewId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/profile');
  revalidatePath('/profile/reviews');
  return { ok: true };
}

/** Админ-модерация: меняет статус видимости отзыва. */
export async function moderateReview(
  reviewId: string,
  status: ModerationStatus,
): Promise<ActionResult> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: 'Доступ только для администратора' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('reviews')
    .update({
      moderation_status: status,
      moderated_by: admin.userId,
      moderated_at: new Date().toISOString(),
    })
    .eq('id', reviewId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/moderation');
  return { ok: true };
}
