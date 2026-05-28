'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Подписаться на пользователя. */
export async function followUser(targetUserId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: 'Нужно войти в аккаунт' };
  if (me.id === targetUserId) {
    return { ok: false, error: 'Нельзя подписаться на самого себя' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: me.id, followee_id: targetUserId });

  // Дубликат подписки не считаем ошибкой
  if (error && error.code !== '23505') {
    return { ok: false, error: error.message };
  }
  revalidatePath('/u/[username]', 'page');
  return { ok: true };
}

/** Отписаться от пользователя. */
export async function unfollowUser(targetUserId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: 'Нужно войти в аккаунт' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', me.id)
    .eq('followee_id', targetUserId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/u/[username]', 'page');
  return { ok: true };
}
