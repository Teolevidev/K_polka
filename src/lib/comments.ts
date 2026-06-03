'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';

export type CommentParentType = 'article' | 'review';

export interface CommentRow {
  id: string;
  body: string;
  createdAt: string;
  author: {
    userId: string;
    displayName: string;
    username: string;
  };
  isMine: boolean;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const COMMENT_SELECT =
  'id, body, created_at, user_id, profiles(display_name, username)';

interface CommentJoinRow {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles: { display_name: string; username: string } | null;
}

/** Список комментариев к целевому объекту (статье или отзыву). */
export async function getComments(
  parentType: CommentParentType,
  parentId: string,
): Promise<CommentRow[]> {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('comments')
    .select(COMMENT_SELECT)
    .eq('parent_type', parentType)
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true });

  return ((data ?? []) as unknown as CommentJoinRow[]).map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    author: {
      userId: r.user_id,
      displayName: r.profiles?.display_name ?? 'Читатель',
      username: r.profiles?.username ?? '',
    },
    isMine: user?.id === r.user_id,
  }));
}

/** Добавляет комментарий. */
export async function addComment(
  parentType: CommentParentType,
  parentId: string,
  body: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };
  const text = body.trim();
  if (text.length < 1) return { ok: false, error: 'Пустой комментарий' };
  if (text.length > 4000) return { ok: false, error: 'Комментарий слишком длинный' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('comments').insert({
    user_id: user.id,
    parent_type: parentType,
    parent_id: parentId,
    body: text,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/blog', 'layout');
  return { ok: true };
}

/** Удаляет свой комментарий. */
export async function deleteComment(commentId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/blog', 'layout');
  return { ok: true };
}
