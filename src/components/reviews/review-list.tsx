import Link from 'next/link';
import { Star, EyeOff, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReviewWithAuthor } from '@/lib/reviews/queries';

interface ReviewListProps {
  reviews: ReviewWithAuthor[];
  /** Заголовок, если выводим как самостоятельную секцию. */
  emptyText?: string;
  className?: string;
}

const DATE_FMT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Список отзывов. Скрытые/на модерации показываются только автору и админу. */
export function ReviewList({
  reviews,
  emptyText = 'Отзывов пока нет',
  className,
}: ReviewListProps) {
  if (reviews.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className={cn('space-y-5', className)}>
      {reviews.map((r) => (
        <li key={r.id} className="rounded-lg border border-border bg-card p-4">
          <header className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {r.author.username ? (
              <Link
                href={`/u/${r.author.username}`}
                className="font-medium hover:underline"
              >
                {r.author.displayName}
                <span className="ml-1 text-sm text-muted-foreground">
                  @{r.author.username}
                </span>
              </Link>
            ) : (
              <span className="font-medium">{r.author.displayName}</span>
            )}
            {typeof r.rating === 'number' && (
              <span className="inline-flex items-center gap-1 text-sm">
                <Star className="size-3.5 fill-accent text-accent" aria-hidden="true" />
                {r.rating}/10
              </span>
            )}
            <time className="ml-auto text-xs text-muted-foreground">
              {DATE_FMT.format(new Date(r.createdAt))}
            </time>
          </header>

          {r.moderationStatus !== 'visible' && (
            <div className="mb-2">
              {r.moderationStatus === 'hidden' && (
                <Badge variant="outline" className="text-destructive">
                  <EyeOff className="mr-1 size-3" /> Скрыт администратором
                </Badge>
              )}
              {r.moderationStatus === 'pending' && (
                <Badge variant="outline">
                  <Clock className="mr-1 size-3" /> На модерации
                </Badge>
              )}
            </div>
          )}

          {r.spoiler ? (
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Содержит спойлеры — показать
              </summary>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{r.body}</p>
            </details>
          ) : (
            <p className="whitespace-pre-line text-sm leading-relaxed">{r.body}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
