import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface UnlockedAchievement {
  id: string;
  nameRu: string;
  descriptionRu: string | null;
  icon: string;
  category: string | null;
  unlockedAt: string;
}

/** Список достижений, разблокированных пользователем. */
export async function getUserAchievements(
  userId: string,
): Promise<UnlockedAchievement[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('user_achievements')
    .select(
      'unlocked_at, achievements(id, name_ru, description_ru, icon, category)',
    )
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false });

  const rows = (data ?? []) as unknown as {
    unlocked_at: string;
    achievements: {
      id: string;
      name_ru: string;
      description_ru: string | null;
      icon: string;
      category: string | null;
    } | null;
  }[];

  return rows
    .filter((r) => r.achievements)
    .map((r) => ({
      id: r.achievements!.id,
      nameRu: r.achievements!.name_ru,
      descriptionRu: r.achievements!.description_ru,
      icon: r.achievements!.icon,
      category: r.achievements!.category,
      unlockedAt: r.unlocked_at,
    }));
}
