import { HomeHero } from '@/components/home/home-hero';
import { HomeMemberBlock } from '@/components/home/member-block';
import { BookRow } from '@/components/home/book-row';
import { QuoteCard } from '@/components/home/quote-card';
import { RecommendationBlock } from '@/components/home/recommendation-block';
import { PollWidget } from '@/components/polls/poll-widget';
import { SectionBand, type BandTone } from '@/components/layout/section-band';
import { Illustration } from '@/components/layout/illustration';
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

  /**
   * Ритм лент. Порядок цветов задан циклом, а не расставлен руками:
   * блоков на главной то больше, то меньше (гость или участник, есть
   * статьи или нет), и при ручной раскраске две ленты одного цвета
   * рано или поздно оказываются рядом. В цикле соседних повторов нет,
   * в том числе на стыке конца и начала.
   */
  const TONE_CYCLE: BandTone[] = ['forest', 'cream', 'sky', 'cream', 'white', 'cream'];

  const blocks: { key: string; node: React.ReactNode }[] = [];

  // Гостям - брендовый экран, участникам сразу личный блок.
  blocks.push(
    userName
      ? {
          key: 'member',
          node: <HomeMemberBlock userName={userName} stats={stats} />,
        }
      : { key: 'hero', node: null },
  );

  blocks.push({
    key: 'popular',
    node: (
      <div className="space-y-8">
        {/* Иллюстрация открывает ленту - крупно и по центру, над первой
            каруселью. Декоративная, поэтому без подписи для читалки. */}
        <Illustration
          className="mx-auto max-w-lg"
          sizes="(min-width: 640px) 512px, 100vw"
        />

        <BookRow
          title="Популярное сейчас"
          subtitle="Что читают в «Книжной полке» на этой неделе"
          books={showcaseSections.popular}
          showAllHref="/discover"
          ranked
        />
      </div>
    ),
  });

  // Рекомендация и опрос - парой сразу под первой каруселью: это два
  // коротких действия, и в одну колонку они растягивали главную вдвое.
  blocks.push({
    key: 'tiles',
    node: (
      <div
        className={cn(
          'grid gap-4',
          poll ? 'sm:grid-cols-2' : 'sm:max-w-xl',
        )}
      >
        <RecommendationBlock isSignedIn={Boolean(user)} />
        {poll && <PollWidget poll={poll} isSignedIn={Boolean(user)} />}
      </div>
    ),
  });

  blocks.push({ key: 'quote', node: <QuoteCard quote={quote} /> });

  if (!userName) {
    blocks.push({
      key: 'invite',
      node: <HomeMemberBlock userName={userName} stats={stats} />,
    });
  }

  if (latestArticles.length > 0) {
    blocks.push({
      key: 'blog',
      node: (
        <div className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-serif text-2xl leading-tight sm:text-3xl">Блог</h2>
              <p className="text-sm opacity-70">Колонки редактора и обзоры</p>
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
                <span className="text-xs uppercase tracking-widest opacity-60">
                  {a.kind === 'editorial'
                    ? 'Колонка'
                    : a.kind === 'review'
                      ? 'Обзор'
                      : 'Заметка'}
                </span>
                <h3 className="mt-2 font-serif text-lg leading-snug">{a.title}</h3>
                {a.excerpt && (
                  <p className="mt-2 line-clamp-3 text-sm opacity-70">{a.excerpt}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      ),
    });
  }

  blocks.push({
    key: 'picks',
    node: (
      <BookRow
        title="Выбор администратора этой недели"
        subtitle="Пять книг, которые советует команда «Книжной полки»"
        books={adminPicks}
        showAllHref="/discover"
      />
    ),
  });

  return (
    <div>
      {blocks.map(({ key, node }, i) =>
        // Герой сам себе лента: у него своя двухколоночная разметка.
        node === null ? (
          <HomeHero key={key} />
        ) : (
          <SectionBand key={key} tone={TONE_CYCLE[i % TONE_CYCLE.length]}>
            {node}
          </SectionBand>
        ),
      )}
    </div>
  );
}
