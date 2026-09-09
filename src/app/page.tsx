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
import { cn } from '@/lib/utils';

export default async function HomePage() {
  const configured = isSupabaseConfigured();

  // Подборка, голосовалка и статьи друг от друга не зависят и от того, кто
  // вошёл, — тоже. Раньше они выполнялись по очереди, и главная ждала сумму
  // всех обращений к Supabase вместо самого долгого из них.
  const [user, editorialPicks, poll, articles] = await Promise.all([
    configured ? getCurrentUser() : Promise.resolve(null),
    configured ? getCurrentEditorialPicks().catch(() => []) : Promise.resolve([]),
    configured ? getActivePoll().catch(() => null) : Promise.resolve(null),
    configured ? getPublishedArticles().catch(() => []) : Promise.resolve([]),
  ]);

  let userName: string | null = null;
  let stats = emptyStats();

  // Маркированные администратором книги — если есть; иначе статичная витрина.
  const adminPicks: BookCardData[] =
    editorialPicks.length > 0
      ? editorialPicks.map((p) => ({
          title: p.title,
          authors: p.authors ? p.authors.split(', ').filter(Boolean) : [],
          coverUrl: p.coverUrl,
          href: `/book/${p.bookRef}`,
        }))
      : showcaseSections.adminPicks;

  if (user) {
    const [profile, readingStats] = await Promise.all([
      getProfile(user.id),
      getReadingStats(user.id),
    ]);
    userName = profile?.display_name ?? user.email?.split('@')[0] ?? 'Читатель';
    stats = readingStats;
  }

  const latestArticles = articles.slice(0, 3);
  const quote = randomQuote();

  return (
    /*
     * Одна полноширинная лента - герой, дальше страница собирается
     * внутри колонки. Сплошные цветные полосы во весь экран одна за
     * другой читались как набор баннеров: глазу не за что зацепиться и
     * непонятно, где кончается один блок и начинается другой. Теперь
     * цвет во всю ширину - редкий акцент, а не структура.
     */
    <div>
      {!userName && <HomeHero />}

      <div className="container max-w-[1200px] space-y-14 py-12 sm:space-y-16">
        {userName && <HomeMemberBlock userName={userName} stats={stats} />}

        <BookRow
          title="Популярное сейчас"
          subtitle="Что читают в «Книжной полке» на этой неделе"
          books={showcaseSections.popular}
          showAllHref="/discover"
          ranked
        />

        {/* Рекомендация и опрос - парой: это два коротких действия, и в
            одну колонку они растягивали главную вдвое. */}
        <div className={cn('grid gap-4', poll ? 'sm:grid-cols-2' : 'sm:max-w-xl')}>
          <RecommendationBlock isSignedIn={Boolean(user)} />
          {poll && <PollWidget poll={poll} isSignedIn={Boolean(user)} />}
        </div>

        <QuoteCard quote={quote} />

        {!userName && <HomeMemberBlock userName={userName} stats={stats} />}

        {latestArticles.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-serif text-2xl leading-tight sm:text-3xl">Блог</h2>
                <p className="text-sm text-muted-foreground">
                  Колонки редактора и обзоры
                </p>
              </div>
              <Link
                href="/blog"
                className="shrink-0 text-sm font-medium underline underline-offset-4 hover:no-underline"
              >
                Все статьи
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {latestArticles.map((a) => (
                <Link
                  key={a.id}
                  href={`/blog/${a.slug}`}
                  className="rounded-lg bg-secondary p-5 transition-colors hover:bg-secondary/70"
                >
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    {a.kind === 'editorial'
                      ? 'Колонка'
                      : a.kind === 'review'
                        ? 'Обзор'
                        : 'Заметка'}
                  </span>
                  <h3 className="mt-2 font-serif text-lg leading-snug">{a.title}</h3>
                  {a.excerpt && (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {a.excerpt}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        <BookRow
          title="Выбор администратора этой недели"
          subtitle="Пять книг, которые советует команда «Книжной полки»"
          books={adminPicks}
          showAllHref="/discover"
        />
      </div>
    </div>
  );
}
