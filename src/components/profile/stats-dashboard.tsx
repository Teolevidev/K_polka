import { BookMarked, CalendarDays, FileText, Star, Flame } from 'lucide-react';
import { type ReadingStats, goalProgress } from '@/lib/stats';
import { formatNumber, plural } from '@/lib/utils';

interface StatsDashboardProps {
  stats: ReadingStats;
}

/** Дашборд статистики чтения: цель года + ключевые метрики. */
export function StatsDashboard({ stats }: StatsDashboardProps) {
  const progress = goalProgress(stats);

  const cards = [
    {
      icon: BookMarked,
      label: 'Всего прочитано',
      value: formatNumber(stats.totalRead),
    },
    {
      icon: CalendarDays,
      label: 'В этом году',
      value: formatNumber(stats.thisYear),
    },
    {
      icon: FileText,
      label: 'Страниц прочитано',
      value: formatNumber(stats.pagesRead),
    },
    {
      icon: Star,
      label: 'Средняя оценка',
      value: stats.avgRating ? stats.avgRating.toFixed(1) : '—',
    },
    {
      icon: Flame,
      label: 'Серия дней',
      value: `${stats.currentStreak}`,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Цель года */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-lg font-semibold">
            Цель на {stats.goalYear} год
          </h2>
          {stats.goalTarget ? (
            <span className="text-sm text-muted-foreground">
              {stats.thisYear} из {stats.goalTarget}{' '}
              {plural(stats.goalTarget, 'книги', 'книг', 'книг')}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Цель не задана</span>
          )}
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {stats.goalTarget
            ? progress >= 100
              ? 'Цель достигнута — отличная работа!'
              : `Выполнено ${progress}%`
            : 'Поставьте цель, чтобы отслеживать прогресс чтения за год.'}
        </p>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <Icon className="size-5 text-primary" aria-hidden="true" />
            <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
