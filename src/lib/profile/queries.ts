import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  phone: string | null;
  gender: 'male' | 'female' | 'other' | null;
  birth_year: number | null;
  favorite_genres: string[];
  onboarded: boolean;
  daily_reminder: boolean;
  reminder_channel: 'email' | 'telegram';
  reminder_time: string;
  telegram_username: string | null;
  reading_goal_year: number | null;
  reading_goal_target: number | null;
  subscription_tier: string;
  role: string;
}

const PROFILE_SELECT =
  'id, username, display_name, bio, avatar_url, phone, gender, birth_year, ' +
  'favorite_genres, onboarded, daily_reminder, reminder_channel, reminder_time, ' +
  'telegram_username, reading_goal_year, reading_goal_target, subscription_tier, role';

/** Профиль пользователя по id. */
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export interface GenreOption {
  slug: string;
  name: string;
}

/** Профиль по никнейму (для публичной страницы /u/[username]). */
export async function getProfileByUsername(
  username: string,
): Promise<ProfileRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('username', username)
    .maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export interface FollowCounts {
  followers: number;
  following: number;
}

/** Счётчики подписчиков и подписок. */
export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const supabase = await createSupabaseServerClient();
  const [followers, following] = await Promise.all([
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('followee_id', userId),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId),
  ]);
  return {
    followers: followers.count ?? 0,
    following: following.count ?? 0,
  };
}

/** Проверка: подписан ли текущий пользователь на target. */
export async function isFollowing(
  followerId: string,
  followeeId: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId)
    .maybeSingle();
  return Boolean(data);
}

/** Список жанров для выбора любимых. */
export async function getGenres(): Promise<GenreOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('genres')
    .select('slug, name_ru')
    .order('name_ru');
  return ((data ?? []) as { slug: string; name_ru: string }[]).map((g) => ({
    slug: g.slug,
    name: g.name_ru,
  }));
}
