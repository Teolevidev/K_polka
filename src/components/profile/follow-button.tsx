'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { followUser, unfollowUser } from '@/lib/profile/follow';

interface FollowButtonProps {
  targetUserId: string;
  isFollowing: boolean;
  isSignedIn: boolean;
  username: string;
}

/** Кнопка подписки/отписки на пользователя. */
export function FollowButton({
  targetUserId,
  isFollowing: initialFollowing,
  isSignedIn,
  username,
}: FollowButtonProps) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!isSignedIn) {
      router.push(`/signin?next=/u/${encodeURIComponent(username)}`);
      return;
    }
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const res = next
        ? await followUser(targetUserId)
        : await unfollowUser(targetUserId);
      if (!res.ok) setFollowing(!next);
      else router.refresh();
    });
  }

  return (
    <Button
      variant={following ? 'secondary' : 'default'}
      size="sm"
      onClick={toggle}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : following ? (
        <UserCheck className="size-4" />
      ) : (
        <UserPlus className="size-4" />
      )}
      {following ? 'Вы подписаны' : 'Подписаться'}
    </Button>
  );
}
