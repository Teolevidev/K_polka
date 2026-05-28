import {
  BookMarked,
  Library,
  Trophy,
  Flame,
  Target,
  PenLine,
  Shapes,
  Award,
  type LucideIcon,
} from 'lucide-react';
import type { UnlockedAchievement } from '@/lib/achievements/queries';

const ICONS: Record<string, LucideIcon> = {
  BookMarked,
  Library,
  Trophy,
  Flame,
  Target,
  PenLine,
  Shapes,
};

interface AchievementsSectionProps {
  achievements: UnlockedAchievement[];
  /** Заголовок секции; передай null, чтобы скрыть. */
  title?: string | null;
}

/** Сетка разблокированных достижений. */
export function AchievementsSection({
  achievements,
  title = 'Достижения',
}: AchievementsSectionProps) {
  if (achievements.length === 0) {
    return (
      <section className="space-y-2">
        {title && <h2 className="font-serif text-lg font-semibold">{title}</h2>}
        <p className="text-sm text-muted-foreground">
          Пока ни одной ачивки. Добавьте книгу на полку, напишите отзыв или
          поставьте цель — и они начнут открываться.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {title && (
        <h2 className="font-serif text-lg font-semibold">
          {title}{' '}
          <span className="text-sm font-normal text-muted-foreground">
            ({achievements.length})
          </span>
        </h2>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {achievements.map((a) => {
          const Icon = ICONS[a.icon] ?? Award;
          return (
            <li
              key={a.id}
              className="flex gap-3 rounded-lg border border-border bg-card p-3"
              title={a.descriptionRu ?? ''}
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{a.nameRu}</p>
                {a.descriptionRu && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {a.descriptionRu}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
