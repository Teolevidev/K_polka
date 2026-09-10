import type { Metadata } from 'next';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
import { getMembers } from '@/lib/social/queries';
import { Avatar } from '@/components/profile/avatar';
import { FollowButton } from '@/components/profile/follow-button';
import { InviteFriend } from '@/components/profile/invite-friend';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Участники' };

export default async function PeoplePage() {
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;
  const members = isSupabaseConfigured() ? await getMembers(user?.id ?? null) : [];

  return (
    <div>
      <PageHeader
        title="Участники"
        subtitle="Подпишитесь на тех, чей вкус вам близок: их полки и отзывы появятся в вашей ленте."
      />

      <div className="container max-w-3xl space-y-6 py-8">

      {members.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-10 text-center">
          <Users className="size-8 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Пока в клубе никого, кроме вас. Позовите тех, с кем хотите
            обсуждать книги.
          </p>
          <InviteFriend />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <li key={m.id} className="rounded-lg bg-secondary/50 p-4">
              <div className="flex items-start gap-3">
                <Link href={`/u/${m.username}`} className="shrink-0">
                  <Avatar name={m.displayName} src={m.avatarUrl} size="md" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/u/${m.username}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {m.displayName}
                  </Link>
                  <p className="text-xs text-muted-foreground">@{m.username}</p>
                  {m.bio && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {m.bio}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <FollowButton
                  targetUserId={m.id}
                  isFollowing={m.isFollowing}
                  isSignedIn={Boolean(user)}
                  username={m.username}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  );
}
