'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Vote, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, plural } from '@/lib/utils';
import { vote, type PollData } from '@/lib/polls';

interface PollWidgetProps {
  poll: PollData;
  isSignedIn: boolean;
}

/** Виджет голосования: вопрос + варианты + результаты после голоса. */
export function PollWidget({ poll, isSignedIn }: PollWidgetProps) {
  const router = useRouter();
  const [myOptionId, setMyOptionId] = useState(poll.myOptionId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const voted = Boolean(myOptionId);
  const showResults = voted || poll.status === 'closed';
  const total = poll.totalVotes + (voted && !poll.myOptionId ? 1 : 0);

  function cast(optionId: string) {
    if (!isSignedIn) {
      router.push('/signin?next=/');
      return;
    }
    setError(null);
    const prev = myOptionId;
    setMyOptionId(optionId);
    startTransition(async () => {
      const res = await vote(poll.id, optionId);
      if (!res.ok) {
        setMyOptionId(prev);
        setError(res.error ?? 'Ошибка');
      } else {
        router.refresh();
      }
    });
  }

  return (
    <section className="container">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Vote className="size-5 text-primary" aria-hidden="true" />
          <h2 className="font-serif text-lg font-semibold sm:text-xl">
            {poll.question}
          </h2>
        </div>

        <ul className="space-y-2">
          {poll.options.map((opt) => {
            const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
            const mine = myOptionId === opt.id;

            if (!showResults) {
              return (
                <li key={opt.id}>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => cast(opt.id)}
                    disabled={pending || poll.status === 'closed'}
                  >
                    {pending && <Loader2 className="size-4 animate-spin" />}
                    {opt.label}
                  </Button>
                </li>
              );
            }

            return (
              <li
                key={opt.id}
                className={cn(
                  'relative overflow-hidden rounded-md border px-3 py-2 text-sm',
                  mine ? 'border-primary' : 'border-border',
                )}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-primary/10"
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <span className={cn('font-medium', mine && 'text-primary')}>
                    {opt.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {pct}% ({opt.votes})
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-xs text-muted-foreground">
          {total} {plural(total, 'голос', 'голоса', 'голосов')}
          {poll.status === 'closed' && ' · голосование закрыто'}
          {!isSignedIn && poll.status === 'open' && (
            <>
              {' · '}
              <Link href="/signin?next=/" className="text-primary hover:underline">
                войдите
              </Link>{' '}
              чтобы голосовать
            </>
          )}
        </p>
        {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      </div>
    </section>
  );
}
