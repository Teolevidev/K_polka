'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, EyeOff, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { moderateReview } from '@/lib/reviews/actions';
import type { ModerationStatus } from '@/lib/reviews/queries';

interface ModerationActionsProps {
  reviewId: string;
  currentStatus: ModerationStatus;
}

/** Кнопки админ-модерации: одобрить / на модерацию / скрыть. */
export function ModerationActions({ reviewId, currentStatus }: ModerationActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ModerationStatus>(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set(next: ModerationStatus) {
    if (next === status) return;
    setError(null);
    const prev = status;
    setStatus(next);
    startTransition(async () => {
      const res = await moderateReview(reviewId, next);
      if (!res.ok) {
        setStatus(prev);
        setError(res.error ?? 'Ошибка');
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant={status === 'visible' ? 'default' : 'outline'}
        onClick={() => set('visible')}
        disabled={pending}
      >
        <Check className="size-4" />
        Одобрить
      </Button>
      <Button
        size="sm"
        variant={status === 'pending' ? 'default' : 'outline'}
        onClick={() => set('pending')}
        disabled={pending}
      >
        <Clock className="size-4" />
        На модерацию
      </Button>
      <Button
        size="sm"
        variant={status === 'hidden' ? 'destructive' : 'outline'}
        onClick={() => set('hidden')}
        disabled={pending}
      >
        <EyeOff className="size-4" />
        Скрыть
      </Button>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
