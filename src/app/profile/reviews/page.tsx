import type { Metadata } from 'next';
import Link from 'next/link';
import { Star, EyeOff, Clock } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
import { getUserReviews } from '@/lib/reviews/queries';
import { SignInPrompt } from '@/components/layout/sign-in-prompt';
import { Badge } from '@/components/ui/badge';
import { cn, plural } from '@/lib/utils';

export const metadata: Metadata = { title: 'Мои отзывы' };

const DATE_FMT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function MyReviewsPage({ searchParams }: PageProps) {
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;
  if (!user) {
    return (
      <SignInPrompt
        title="Мои отзывы"
        description="Войдите, чтобы видеть свой блог отзывов."
        next="/profile/reviews"
      />
    );
  }

  const all = await getUserReviews(user.id, user.id);
  const { year } = await searchParams;

  // Доступные годы для фильтра
  const yearsSet = new Set<number>();
  for (const r of all) yearsSet.add(new Date(r.createdAt).getFullYear());
  const years = Array.from(yearsSet).sort((a, b) => b - a);

  const filterYear = year && /^\d{4}$/.test(year) ? Number(year) : null;
  const visible = filterYear
    ? all.filter((r) => new Date(r.createdAt).getFullYear() === filterYear)
    : all;

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Мои отзывы</h1>
          <p className="text-sm text-muted-foreground">
            Личный блог из {all.length}{' '}
            {plural(all.length, 'отзыва', 'отзывов', 'отзывов')}
          </p>
        </div>
        <Link
          href="/profile"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← К профилю
        </Link>
      </header>

      {/* Фильтр по году */}
      {years.length > 0 && (
        <nav className="flex flex-wrap gap-1">
          <Link
            href="/profile/reviews"
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              !filterYear
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-secondary',
            )}
          >
            Все
          </Link>
          {years.map((y) => (
            <Link
              key={y}
              href={`/profile/reviews?year=${y}`}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                filterYear === y
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-secondary',
              )}
            >
              {y}
            </Link>
          ))}
        </nav>
      )}

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          За этот период отзывов нет
        </p>
      ) : (
        <ul className="space-y-4">
          {visible.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link
                  href={r.book.href}
                  className="font-medium text-primary hover:underline"
                >
                  {r.book.title}
                </Link>
                {r.book.authors.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {r.book.authors.join(', ')}
                  </span>
                )}
                {typeof r.rating === 'number' && (
                  <span className="inline-flex items-center gap-1 text-sm">
                    <Star
                      className="size-3.5 fill-accent text-accent"
                      aria-hidden="true"
                    />
                    {r.rating}/10
                  </span>
                )}
                <time className="ml-auto text-xs text-muted-foreground">
                  {DATE_FMT.format(new Date(r.createdAt))}
                </time>
              </div>

              {r.moderationStatus !== 'visible' && (
                <div className="mb-2">
                  {r.moderationStatus === 'hidden' && (
                    <Badge variant="outline" className="text-destructive">
                      <EyeOff className="mr-1 size-3" /> Скрыт администратором
                    </Badge>
                  )}
                  {r.moderationStatus === 'pending' && (
                    <Badge variant="outline">
                      <Clock className="mr-1 size-3" /> На модерации
                    </Badge>
                  )}
                </div>
              )}

              <details>
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Показать отзыв полностью
                </summary>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                  {r.body}
                </p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
