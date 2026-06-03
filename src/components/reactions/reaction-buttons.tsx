'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  toggleReaction,
  type ReactionKind,
  type ReactionTargetType,
} from '@/lib/reactions';

interface ReactionButtonsProps {
  targetType: ReactionTargetType;
  targetId: string;
  isSignedIn: boolean;
  initial: { likes: number; dislikes: number; myKind: ReactionKind | null };
  signinHref?: string;
}

/** Кнопки лайк / дизлайк с оптимистичным обновлением. */
export function ReactionButtons({
  targetType,
  targetId,
  isSignedIn,
  initial,
  signinHref = '/signin',
}: ReactionButtonsProps) {
  const router = useRouter();
  const [likes, setLikes] = useState(initial.likes);
  const [dislikes, setDislikes] = useState(initial.dislikes);
  const [myKind, setMyKind] = useState<ReactionKind | null>(initial.myKind);
  const [pending, startTransition] = useTransition();

  function toggle(kind: ReactionKind) {
    if (!isSignedIn) {
      router.push(signinHref);
      return;
    }

    // Оптимистично применяем изменение
    const wasKind = myKind;
    if (wasKind === kind) {
      setMyKind(null);
      kind === 'like' ? setLikes((v) => v - 1) : setDislikes((v) => v - 1);
    } else {
      setMyKind(kind);
      if (wasKind === 'like') setLikes((v) => v - 1);
      if (wasKind === 'dislike') setDislikes((v) => v - 1);
      kind === 'like' ? setLikes((v) => v + 1) : setDislikes((v) => v + 1);
    }

    startTransition(async () => {
      const res = await toggleReaction(targetType, targetId, kind);
      if (!res.ok) {
        // откат — перечитаем со страницы
        router.refresh();
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => toggle('like')}
        disabled={pending}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm transition-colors',
          myKind === 'like'
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border text-muted-foreground hover:text-foreground',
        )}
        aria-pressed={myKind === 'like'}
      >
        <ThumbsUp className="size-3.5" />
        {likes}
      </button>
      <button
        type="button"
        onClick={() => toggle('dislike')}
        disabled={pending}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm transition-colors',
          myKind === 'dislike'
            ? 'border-destructive bg-destructive/10 text-destructive'
            : 'border-border text-muted-foreground hover:text-foreground',
        )}
        aria-pressed={myKind === 'dislike'}
      >
        <ThumbsDown className="size-3.5" />
        {dislikes}
      </button>
    </div>
  );
}
