'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';

export type ReactionTargetType = 'review' | 'comment' | 'article';
export type ReactionKind = 'like' | 'dislike';

export interface ReactionSummary {
  likes: number;
  dislikes: number;
  myKind: ReactionKind | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Ставит/обновляет/снимает реакцию пользователя.
 * Повторное нажатие того же варианта снимает реакцию.
 */
export async function toggleReaction(
  targetType: ReactionTargetType,
  targetId: string,
  kind: ReactionKind,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from('reactions')
    .select('kind')
    .eq('user_id', user.id)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle();

  if (existing?.kind === kind) {
    const { error } = await supabase
      .from('reactions')
      .delete()
      .eq('user_id', user.id)
      .eq('target_type', targetType)
      .eq('target_id', targetId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from('reactions').upsert(
      {
        user_id: user.id,
        target_type: targetType,
        target_id: targetId,
        kind,
      },
      { onConflict: 'user_id,target_type,target_id' },
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/', 'layout'); // обновляем все страницы — реакции на разных
  return { ok: true };
}

/** Загружает счётчики реакций + личную реакцию пользователя. */
export async function getReactionSummary(
  targetType: ReactionTargetType,
  targetId: string,
): Promise<ReactionSummary> {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('reactions')
    .select('user_id, kind')
    .eq('target_type', targetType)
    .eq('target_id', targetId);

  const rows = (data ?? []) as { user_id: string; kind: ReactionKind }[];
  const likes = rows.filter((r) => r.kind === 'like').length;
  const dislikes = rows.filter((r) => r.kind === 'dislike').length;
  const mine = user ? rows.find((r) => r.user_id === user.id) : null;

  return { likes, dislikes, myKind: (mine?.kind as ReactionKind | undefined) ?? null };
}
