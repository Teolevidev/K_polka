import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Пересчёт достижений пользователя.
 *
 * Вызывается из server actions (addBookToShelf, submitReview, setReadingGoal).
 * Считает текущие показатели, определяет, какие достижения должны быть
 * разблокированы, и вставляет недостающие записи в user_achievements.
 * Безопасно вызывать многократно — дубликаты игнорируются.
 */
export async function recomputeAchievements(userId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const year = new Date().getFullYear();

  // Параллельные запросы — счётчики и профиль
  const [readRows, reviewsCountRes, profileRes, alreadyRes] = await Promise.all([
    supabase
      .from('user_books')
      .select('finished_at', { count: 'exact' })
      .eq('user_id', userId)
      .eq('status', 'read'),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('profiles')
      .select('reading_goal_year, reading_goal_target')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId),
  ]);

  const totalRead = readRows.count ?? 0;
  const thisYear = ((readRows.data ?? []) as { finished_at: string | null }[])
    .filter((r) => r.finished_at && r.finished_at.startsWith(String(year)))
    .length;
  const reviewsCount = reviewsCountRes.count ?? 0;
  const goalReached =
    profileRes.data?.reading_goal_year === year &&
    !!profileRes.data?.reading_goal_target &&
    thisYear >= profileRes.data.reading_goal_target;

  // Какие достижения должны быть разблокированы
  const target = new Set<string>();
  if (totalRead >= 1) target.add('first_book');
  if (totalRead >= 10) target.add('books_10');
  if (totalRead >= 25) target.add('books_25');
  if (totalRead >= 50) target.add('books_50');
  if (totalRead >= 100) target.add('books_100');
  if (reviewsCount >= 1) target.add('first_review');
  if (goalReached) target.add('goal_reached');

  // Уже разблокированные
  const already = new Set(
    ((alreadyRes.data ?? []) as { achievement_id: string }[]).map(
      (r) => r.achievement_id,
    ),
  );
  const toInsert = [...target].filter((id) => !already.has(id));
  if (toInsert.length === 0) return;

  await supabase
    .from('user_achievements')
    .insert(toInsert.map((achievement_id) => ({ user_id: userId, achievement_id })));
}
