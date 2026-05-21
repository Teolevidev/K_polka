/** Статистика чтения пользователя. */
export interface ReadingStats {
  totalRead: number;
  thisYear: number;
  pagesRead: number;
  avgRating: number | null;
  currentStreak: number;
  longestStreak: number;
  goalYear: number;
  goalTarget: number | null;
}

/** Пустая статистика — для нового пользователя или до загрузки из БД. */
export function emptyStats(year = new Date().getFullYear()): ReadingStats {
  return {
    totalRead: 0,
    thisYear: 0,
    pagesRead: 0,
    avgRating: null,
    currentStreak: 0,
    longestStreak: 0,
    goalYear: year,
    goalTarget: null,
  };
}

/** Прогресс по годовой цели в процентах (0..100). */
export function goalProgress(stats: ReadingStats): number {
  if (!stats.goalTarget || stats.goalTarget <= 0) return 0;
  return Math.min(100, Math.round((stats.thisYear / stats.goalTarget) * 100));
}
