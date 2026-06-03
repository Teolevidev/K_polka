import Link from 'next/link';
import { Library, Target, ArrowRight, BookMarked, Star, Flame } from 'lucide-react';
import { type ReadingStats, goalProgress } from '@/lib/stats';
import { plural, formatNumber } from '@/lib/utils';

interface HomeMemberBlockProps {
  /** Имя пользователя, если он вошёл; иначе null. */
  userName: string | null;
  stats: ReadingStats;
}

/**
 * Персональный блок на главной — личные мотиваторы заходить на сайт.
 * Размещается максимально высоко.
 *  - гость: приглашение стать участником (карточки-ссылки на вход)
 *  - участник: его статистика чтения (плитки-ссылки в профиль/полку)
 */
export function HomeMemberBlock({ userName, stats }: HomeMemberBlockProps) {
  return userName ? (
    <MemberStats userName={userName} stats={stats} />
  ) : (
    <GuestInvitation />
  );
}

/* ---------- Участник: статистика ---------- */

function MemberStats({ userName, stats }: { userName: string; stats: ReadingStats }) {
  const progress = goalProgress(stats);

  const tiles = [
    {
      href: '/profile',
      icon: Target,
      label: `Цель ${stats.goalYear}`,
      value: stats.goalTarget
        ? `${stats.thisYear} / ${stats.goalTarget}`
        : 'Поставить цель',
      hint: stats.goalTarget ? `выполнено ${progress}%` : 'нажмите, чтобы задать',
    },
    {
      href: '/library',
      icon: BookMarked,
      label: 'Прочитано',
      value: formatNumber(stats.totalRead),
      hint: `${plural(stats.totalRead, 'книга', 'книги', 'книг')} на полке`,
    },
    {
      href: '/profile',
      icon: Star,
      label: 'Средняя оценка',
      value: stats.avgRating ? stats.avgRating.toFixed(1) : '—',
      hint: stats.avgRating ? 'из 10' : 'оцените прочитанное',
    },
  ];

  return (
    <section className="container">
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold sm:text-2xl">
            С возвращением, {userName}
          </h2>
          <Link
            href="/profile"
            className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary hover:underline"
          >
            Профиль
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {tiles.map(({ href, icon: Icon, label, value, hint }) => (
            <Link
              key={label}
              href={href}
              className="group rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-secondary/50"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="size-4 text-primary" aria-hidden="true" />
                <span className="text-xs">{label}</span>
              </div>
              <p className="mt-1.5 text-xl font-bold leading-tight">{value}</p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </Link>
          ))}
        </div>

        {stats.goalTarget ? (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- Гость: приглашение ---------- */

function GuestInvitation() {
  const cards = [
    {
      icon: Library,
      title: 'Личная библиотека',
      text: 'Полки «Читаю», «Прочитано», «Хочу прочесть» и свои подборки.',
      href: '/signin?next=/library',
    },
    {
      icon: Target,
      title: 'Цели на год',
      text: 'Поставьте цель по числу книг и следите за прогрессом.',
      href: '/signin?next=/profile',
    },
    {
      icon: Flame,
      title: 'Серии и достижения',
      text: 'Отмечайте дни чтения, держите серию, открывайте бейджи.',
      href: '/signin?next=/profile',
    },
  ];

  return (
    <section className="container">
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">
              Заведите свою полку
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Бесплатно. Личная статистика, цели и достижения — для тех, кто вошёл.
            </p>
          </div>
          <Link
            href="/signin"
            className="hidden shrink-0 items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:inline-flex"
          >
            Присоединиться
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map(({ icon: Icon, title, text, href }) => (
            <Link
              key={title}
              href={href}
              className="group rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-secondary/50"
            >
              <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <h3 className="flex items-center gap-1 text-sm font-semibold">
                {title}
                <ArrowRight
                  className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
            </Link>
          ))}
        </div>

        <Link
          href="/signin"
          className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:hidden"
        >
          Присоединиться
        </Link>
      </div>
    </section>
  );
}
