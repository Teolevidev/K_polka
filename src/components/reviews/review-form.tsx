'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { submitReview, deleteOwnReview } from '@/lib/reviews/actions';
import type { ReviewWithAuthor } from '@/lib/reviews/queries';

interface ReviewFormProps {
  bookRef: string;
  isSignedIn: boolean;
  initial: ReviewWithAuthor | null;
}

/** Форма написания/редактирования отзыва на книгу. */
export function ReviewForm({ bookRef, isSignedIn, initial }: ReviewFormProps) {
  const router = useRouter();
  const [body, setBody] = useState(initial?.body ?? '');
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [spoiler, setSpoiler] = useState(initial?.spoiler ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!isSignedIn) {
    return (
      <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm">
        Войдите, чтобы оставить отзыв.{' '}
        <a
          href={`/signin?next=/book/${bookRef}`}
          className="font-medium text-primary hover:underline"
        >
          Войти
        </a>
      </div>
    );
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await submitReview({ bookRef, body, rating, spoiler });
      if (!res.ok) setError(res.error ?? 'Ошибка');
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!initial?.id) return;
    if (!confirm('Удалить отзыв?')) return;
    startTransition(async () => {
      const res = await deleteOwnReview(initial.id);
      if (!res.ok) setError(res.error ?? 'Ошибка');
      else {
        setBody('');
        setRating(null);
        setSpoiler(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h3 className="font-medium">{initial ? 'Ваш отзыв' : 'Написать отзыв'}</h3>

      {/* Оценка */}
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Оценка (необязательно)</p>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const active = rating !== null && n <= rating;
            return (
              <button
                key={n}
                type="button"
                aria-label={`Поставить ${n}`}
                onClick={() => setRating(rating === n ? null : n)}
                className={cn(
                  'flex size-7 items-center justify-center rounded transition-colors hover:bg-secondary',
                  active && 'text-accent',
                )}
              >
                <Star
                  className={cn('size-4', active ? 'fill-accent' : 'text-muted-foreground')}
                />
              </button>
            );
          })}
          {rating !== null && (
            <button
              type="button"
              onClick={() => setRating(null)}
              className="ml-2 text-xs text-muted-foreground hover:text-foreground"
            >
              сбросить ({rating}/10)
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs text-muted-foreground">Текст отзыва</p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={10000}
          placeholder="Поделитесь впечатлениями…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={spoiler}
          onChange={(e) => setSpoiler(e.target.checked)}
          className="size-4 accent-[hsl(var(--primary))]"
        />
        Содержит спойлеры
      </label>

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={pending || body.trim().length < 5}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {initial ? 'Сохранить' : 'Опубликовать'}
        </Button>
        {initial && (
          <Button variant="ghost" onClick={remove} disabled={pending}>
            <Trash2 className="size-4" />
            Удалить
          </Button>
        )}
        {saved && <span className="text-sm text-primary">Сохранено</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}
