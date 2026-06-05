import { HomeHero } from '@/components/home/home-hero';
import { HomeMemberBlock } from '@/components/home/member-block';
import { BookRow } from '@/components/home/book-row';
import { QuoteCard } from '@/components/home/quote-card';
import { RecommendationBlock } from '@/components/home/recommendation-block';
import { PollWidget } from '@/components/polls/poll-widget';
import { randomQuote } from '@/lib/quotes/data';
import { showcaseSections } from '@/lib/books/showcase';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
import { getProfile } from '@/lib/profile/queries';
import { getReadingStats } from '@/lib/shelf/queries';
import { getCurrentEditorialPicks } from '@/lib/editorial/queries';
import { getActivePoll } from '@/lib/polls';
import { getPublishedArticles } from '@/lib/articles/queries';
import { emptyStats } from '@/lib/stats';
import type { BookCardData } from '@/components/book/book-card';
import Link from 'next/link';

export default async function HomePage() {
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;

  let userName: string | null = null;
  let stats = emptyStats();
  let adminPicks: BookCardData[] = showcaseSections.adminPicks;

  // Маркированные администратором книги — если есть; иначе статичная витрина.
  if (isSupabaseConfigured()) {
    try {
      const live = await getCurrentEditorialPicks();
      if (live.length > 0) {
        adminPicks = live.map((p) => ({
          title: p.title,
          authors: p.authors ? p.authors.split(', ').filter(Boolean) : [],
          coverUrl: p.coverUrl,
          href: `/book/${p.bookRef}`,
        }));
      }
    } catch {
      // fallback на статичную подборку
    }
  }

  if (user) {
    const [profile, readingStats] = await Promise.all([
      getProfile(user.id),
      getReadingStats(user.id),
    ]);
    userName = profile?.display_name ?? user.email?.split('@')[0] ?? 'Читатель';
    stats = readingStats;
  }

  // Активная голосовалка и свежие статьи блога
  const poll = isSupabaseConfigured() ? await getActivePoll().catch(() => null) : null;
  const articles = isSupabaseConfigured()
    ? await getPublishedArticles().catch(() => [])
    : [];
  const latestArticles = articles.slice(0, 3);
  const quote = randomQuote();

  return (
    <div className="space-y-10 pb-8 pt-2">
      {/* Гостям — маркетинговый экран; участникам сразу персональный блок */}
      {!userName && <HomeHero />}

      {/* Персональный блок — максимально высоко, личные мотиваторы */}
      <HomeMemberBlock userName={userName} stats={stats} />

      <QuoteCard quote={quote} />

      <RecommendationBlock isSignedIn={Boolean(user)} />

      {poll && <PollWidget poll={poll} isSignedIn={Boolean(user)} />}

      {latestArticles.length > 0 && (
        <section className="container space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold sm:text-2xl">Блог</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Колонки редактора и обзоры
              </p>
            </div>
            <Link
              href="/blog"
              className="text-sm font-medium text-primary hover:underline"
            >
              Все статьи →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {latestArticles.map((a) => (
              <Link
                key={a.id}
                href={`/blog/${a.slug}`}
                className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {a.kind === 'editorial' ? 'Колонка' : a.kind === 'review' ? 'Обзор' : 'Заметка'}
                </span>
                <h3 className="mt-1 font-semibold leading-tight">{a.title}</h3>
                {a.excerpt && (
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                    {a.excerpt}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <BookRow
        title="Популярное сейчас"
        subtitle="Что читают в «Книжной полке» на этой неделе"
        books={showcaseSections.popular}
        showAllHref="/discover"
        ranked
      />

      <BookRow
        title="Выбор администратора этой недели"
        subtitle="Пять книг, которые советует команда «Книжной полки»"
        books={adminPicks}
        showAllHref="/discover"
      />
    </div>
  );
}
