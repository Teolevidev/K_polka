import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Users, BookMarked } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
import {
  getProfileByUsername,
  getFollowCounts,
  isFollowing,
} from '@/lib/profile/queries';
import { getUserReviews } from '@/lib/reviews/queries';
import { FollowButton } from '@/components/profile/follow-button';
import { formatNumber, plural } from '@/lib/utils';

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(decodeURIComponent(username));
  if (!profile) return { title: 'Профиль не найден' };
  return {
    title: profile.display_name,
    description: profile.bio ?? `${profile.display_name} на Книжной полке`,
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  const profile = await getProfileByUsername(decodeURIComponent(username));
  if (!profile) notFound();

  const me = isSupabaseConfigured() ? await getCurrentUser() : null;
  const isOwn = me?.id === profile.id;

  const [counts, following, reviews] = await Promise.all([
    getFollowCounts(profile.id),
    me && !isOwn ? isFollowing(me.id, profile.id) : Promise.resolve(false),
    getUserReviews(profile.id, me?.id ?? null),
  ]);

  const visibleReviews = isOwn
    ? reviews
    : reviews.filter((r) => r.moderationStatus === 'visible');

  const initial = profile.display_name.charAt(0).toUpperCase();

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      {/* Шапка профиля */}
      <header className="flex flex-wrap items-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold leading-tight">
            {profile.display_name}
          </h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" aria-hidden="true" />
              <strong className="text-foreground">{formatNumber(counts.followers)}</strong>{' '}
              {plural(counts.followers, 'подписчик', 'подписчика', 'подписчиков')}
            </span>
            <span className="inline-flex items-center gap-1">
              <strong className="text-foreground">{formatNumber(counts.following)}</strong>{' '}
              подписок
            </span>
            <span className="inline-flex items-center gap-1">
              <BookMarked className="size-4" aria-hidden="true" />
              <strong className="text-foreground">{formatNumber(visibleReviews.length)}</strong>{' '}
              {plural(visibleReviews.length, 'отзыв', 'отзыва', 'отзывов')}
            </span>
          </p>
        </div>
        {!isOwn && (
          <FollowButton
            targetUserId={profile.id}
            isFollowing={following}
            isSignedIn={Boolean(me)}
            username={profile.username}
          />
        )}
        {isOwn && (
          <Link
            href="/profile/edit"
            className="text-sm font-medium text-primary hover:underline"
          >
            Редактировать профиль
          </Link>
        )}
      </header>

      {profile.bio && (
        <p className="text-sm leading-relaxed text-foreground/90">{profile.bio}</p>
      )}

      {/* Отзывы */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Отзывы и впечатления</h2>
        {visibleReviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет отзывов.</p>
        ) : (
          <ul className="space-y-4">
            {visibleReviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-card p-4">
                <Link
                  href={r.book.href}
                  className="font-medium text-primary hover:underline"
                >
                  {r.book.title}
                </Link>
                {r.book.authors.length > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    {r.book.authors.join(', ')}
                  </span>
                )}
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed line-clamp-3">
                  {r.body}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(r.createdAt))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
