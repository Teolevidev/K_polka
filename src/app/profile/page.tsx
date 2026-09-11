import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
import { getProfile, getFollowCounts } from '@/lib/profile/queries';
import { getReadingStats, getUserShelfBooks } from '@/lib/shelf/queries';
import { getUserReviews } from '@/lib/reviews/queries';
import { getUserAchievements } from '@/lib/achievements/queries';
import { getActivePoll } from '@/lib/polls';
import {
  getActivityFeed,
  getSimilarReaders,
  getMemberShelves,
  getSuggestedBooks,
} from '@/lib/social/queries';

import { BackButton } from '@/components/layout/back-button';
import { SignInPrompt } from '@/components/layout/sign-in-prompt';
import { StatsDashboard } from '@/components/profile/stats-dashboard';
import { GoalSetter } from '@/components/profile/goal-setter';
import { AchievementsSection } from '@/components/profile/achievements-section';
import { Avatar } from '@/components/profile/avatar';
import { SectionBand } from '@/components/layout/section-band';
import { SignOutButton } from '@/components/auth/sign-out-button';
import {
  AddBookBox,
  ActivityFeed,
  SimilarReaders,
  MemberShelves,
  SuggestedBooks,
} from '@/components/profile/dashboard-blocks';
import { RecommendationBlock } from '@/components/home/recommendation-block';
import { PollWidget } from '@/components/polls/poll-widget';
import { Button } from '@/components/ui/button';
import { formatNumber, plural, cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Профиль' };

export default async function ProfilePage() {
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;

  if (!user) {
    return (
      <SignInPrompt
        title="Профиль"
        description="Войдите, чтобы видеть статистику чтения, серии дней и прогресс по цели."
        next="/profile"
      />
    );
  }

  // Все блоки кабинета независимы друг от друга, поэтому грузятся
  // разом: последовательно страница ждала бы сумму всех обращений.
  const [
    profile,
    stats,
    counts,
    reviews,
    achievements,
    shelf,
    feed,
    shelves,
    suggested,
    poll,
  ] = await Promise.all([
      getProfile(user.id),
      getReadingStats(user.id),
      getFollowCounts(user.id),
      getUserReviews(user.id, user.id),
      getUserAchievements(user.id),
      getUserShelfBooks(user.id).catch(() => []),
      getActivityFeed(user.id).catch(() => []),
      getMemberShelves(user.id).catch(() => []),
      getSuggestedBooks(user.id).catch(() => []),
      getActivePoll().catch(() => null),
    ]);

  // Похожий вкус считается по любимым жанрам, а их знает только профиль,
  // поэтому этот запрос идет вторым заходом.
  const similar = await getSimilarReaders(
    user.id,
    profile?.favorite_genres ?? [],
  ).catch(() => []);

  const displayName = profile?.display_name ?? user.email?.split('@')[0] ?? 'Читатель';

  return (
    <div>
      {/* Шапка профиля - на той же зеленой ленте, что и первый экран
          главной: это личная обложка читателя. */}
      <SectionBand tone="forest" className="py-8 sm:py-10">
        <div className="mx-auto mb-3 max-w-5xl">
          <BackButton onBand />
        </div>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 text-cream">
          <Avatar name={displayName} src={profile?.avatar_url} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl leading-tight sm:text-3xl">
              {displayName}
            </h1>
            {profile?.username && (
              <p className="text-sm opacity-80">
                @{profile.username}
                <Link
                  href={`/u/${profile.username}`}
                  className="ml-2 underline underline-offset-4 hover:no-underline"
                >
                  посмотреть как видят другие
                </Link>
              </p>
            )}
            <p className="mt-2 flex flex-wrap gap-x-4 text-sm opacity-90">
              <span>
                <strong>{formatNumber(counts.followers)}</strong>{' '}
                {plural(counts.followers, 'подписчик', 'подписчика', 'подписчиков')}
              </span>
              <span>
                <strong>{formatNumber(counts.following)}</strong> подписок
              </span>
              <span>
                <strong>{formatNumber(reviews.length)}</strong>{' '}
                {plural(reviews.length, 'отзыв', 'отзыва', 'отзывов')}
              </span>
            </p>
            {profile?.bio && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed opacity-90">
                {profile.bio}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="onBand" size="sm" asChild>
              <Link href="/profile/edit">
                <Pencil className="size-4" />
                Редактировать
              </Link>
            </Button>
            <SignOutButton />
          </div>
        </div>
      </SectionBand>

      <div className="container max-w-5xl space-y-6 py-8">
      <StatsDashboard stats={stats} />

      {/* Рекомендация и опрос переехали сюда с публичной главной.
          Гостю они ничего не говорили: советовать книгу и спрашивать
          мнение имеет смысл у того, кто уже в клубе. Парой, а не в
          колонку - это два коротких действия. */}
      <div className={cn('grid gap-4', poll ? 'sm:grid-cols-2' : 'sm:max-w-xl')}>
        <RecommendationBlock isSignedIn />
        {poll && <PollWidget poll={poll} isSignedIn />}
      </div>

      {/* Две колонки: слева свое чтение, справа клуб. Так устроен
          личный кабинет в опорном примере, и это работает: собственные
          действия и чужая активность не мешают друг другу. */}
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-8">
          {shelf.length === 0 && <AddBookBox />}

          <section className="space-y-3">
            <h2 className="font-serif text-xl leading-tight">Цель года</h2>
            <GoalSetter year={stats.goalYear} currentTarget={stats.goalTarget} />
          </section>

          <SuggestedBooks books={suggested} />

          <MemberShelves shelves={shelves} />
        </div>

        <div className="space-y-8">
          <ActivityFeed items={feed} />

          <SimilarReaders
            readers={similar}
            hasGenres={(profile?.favorite_genres ?? []).length > 0}
          />
        </div>
      </div>

      <AchievementsSection achievements={achievements} />

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/library">Моя полка</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/profile/reviews">
            Мои отзывы ({formatNumber(reviews.length)})
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/people">Участники</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/search">Найти книгу</Link>
        </Button>
      </div>
      </div>
    </div>
  );
}
