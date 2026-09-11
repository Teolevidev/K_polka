'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, type PanInfo } from 'motion/react';
import { ArrowLeft, ArrowRight, Clock, EyeOff, Star } from 'lucide-react';
import type { ReviewWithAuthor } from '@/lib/reviews/queries';
import type { ReactionSummary } from '@/lib/reactions';
import { ReactionButtons } from '@/components/reactions/reaction-buttons';
import { Avatar } from '@/components/profile/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Отзывы стопкой карточек.
 *
 * Список отзывов растягивал страницу книги на экраны вниз, и до
 * «Другие книги автора» мало кто доходил. Стопка занимает место одной
 * карточки, а листается пальцем, стрелками и клавишами.
 *
 * Пружина, а не линейное затухание: карточка, брошенная свайпом,
 * должна вести себя как предмет, иначе жест ощущается «пластиковым».
 */

interface ReviewsCarouselProps {
  reviews: ReviewWithAuthor[];
  reactionSummaries?: Record<string, ReactionSummary>;
  isSignedIn?: boolean;
  signinHref?: string;
  className?: string;
  /** Что написать, когда отзывов нет. */
  emptyText?: string;
}

const DATE_FMT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Сколько карточек видно в стопке за верхней. */
const STACK_DEPTH = 2;

/**
 * Высота карточки фиксирована, и это осознанно.
 *
 * Отзывы бывают в строку и на три абзаца. Если карточка тянется по
 * содержимому, стопка при каждом листании прыгает, а нижние карточки
 * то выглядывают, то прячутся - вместо стопки получается дерготня.
 * Длинный текст прокручивается внутри.
 */
const CARD_HEIGHT = 216;

/** На сколько точек каждая следующая карточка выглядывает снизу. */
const PEEK = 12;

/** Насколько далеко надо утащить карточку, чтобы она улетела. */
const SWIPE_DISTANCE = 90;
const SWIPE_VELOCITY = 400;

const SPRING = { type: 'spring', stiffness: 320, damping: 32, mass: 0.8 } as const;

export function ReviewsCarousel({
  reviews,
  reactionSummaries,
  isSignedIn = false,
  signinHref = '/signin',
  className,
  emptyText = 'Отзывов пока нет',
}: ReviewsCarouselProps) {
  const [index, setIndex] = useState(0);
  // Куда ушла предыдущая карточка: от этого зависит, с какой стороны
  // прилетает следующая.
  const [direction, setDirection] = useState(1);

  const total = reviews.length;

  const go = useCallback(
    (step: number) => {
      if (total < 2) return;
      setDirection(step);
      setIndex((prev) => (prev + step + total) % total);
    },
    [total],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  function onDragEnd(_: unknown, info: PanInfo) {
    const far = Math.abs(info.offset.x) > SWIPE_DISTANCE;
    const fast = Math.abs(info.velocity.x) > SWIPE_VELOCITY;
    if (far || fast) go(info.offset.x < 0 ? 1 : -1);
  }

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  // Верхняя карточка и те, что видны за ней.
  const visible = Array.from({ length: Math.min(STACK_DEPTH + 1, total) }, (_, i) => ({
    review: reviews[(index + i) % total],
    depth: i,
  }));

  return (
    <div className={cn('space-y-4', className)}>
      <div className="relative" style={{ perspective: 1200 }}>
        {/* Стопка. Один AnimatePresence на весь набор, а не на каждую
            карточку: иначе у него всегда один ребенок, и уход карточки
            не анимируется вовсе. Рисуем с конца, чтобы верхняя шла
            последней в потоке и перекрывала остальные без z-index. */}
        <div
          className="relative"
          style={{ height: CARD_HEIGHT + STACK_DEPTH * PEEK }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {visible
              .slice()
              .reverse()
              .map(({ review, depth }) => {
                const isTop = depth === 0;
                return (
                  <motion.article
                    key={review.id}
                    className={cn(
                      'absolute inset-x-0 top-0 overflow-hidden rounded-lg border border-border bg-card p-5',
                      !isTop && 'pointer-events-none',
                      isTop && total > 1 && 'cursor-grab active:cursor-grabbing',
                    )}
                    style={{ height: CARD_HEIGHT }}
                    initial={{ opacity: 0, x: direction * 60, scale: 0.96 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      // Карточки за верхней уходят вниз и сужаются -
                      // так видно, что за ней есть еще.
                      y: depth * PEEK,
                      scale: 1 - depth * 0.04,
                    }}
                    exit={{ opacity: 0, x: -direction * 80, scale: 0.96 }}
                    transition={SPRING}
                    drag={isTop && total > 1 ? 'x' : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.25}
                    onDragEnd={isTop ? onDragEnd : undefined}
                    aria-hidden={!isTop}
                  >
                    <ReviewCard
                      review={review}
                      interactive={isTop}
                      summary={reactionSummaries?.[review.id]}
                      isSignedIn={isSignedIn}
                      signinHref={signinHref}
                      showReactions={Boolean(reactionSummaries)}
                    />
                  </motion.article>
                );
              })}
          </AnimatePresence>
        </div>
      </div>

      {total > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {index + 1} из {total}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-full"
              onClick={() => go(-1)}
              aria-label="Предыдущий отзыв"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-full"
              onClick={() => go(1)}
              aria-label="Следующий отзыв"
            >
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ReviewCardProps {
  review: ReviewWithAuthor;
  /** Нижние карточки стопки не кликаются - иначе жмешь мимо. */
  interactive: boolean;
  summary?: ReactionSummary;
  isSignedIn: boolean;
  signinHref: string;
  showReactions: boolean;
}

function ReviewCard({
  review,
  interactive,
  summary,
  isSignedIn,
  signinHref,
  showReactions,
}: ReviewCardProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col gap-3',
        !interactive && 'pointer-events-none select-none',
      )}
    >
      <header className="flex items-start gap-3">
        <Avatar name={review.author.displayName} size="sm" />
        <div className="min-w-0 flex-1">
          {review.author.username && interactive ? (
            <Link
              href={`/u/${review.author.username}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {review.author.displayName}
            </Link>
          ) : (
            <span className="font-medium">{review.author.displayName}</span>
          )}
          <p className="text-xs text-muted-foreground">
            {review.author.username && `@${review.author.username} · `}
            {DATE_FMT.format(new Date(review.createdAt))}
          </p>
        </div>

        {typeof review.rating === 'number' && (
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium">
            <Star className="size-4 fill-accent text-accent" aria-hidden="true" />
            {review.rating}/10
          </span>
        )}
      </header>

      {review.moderationStatus !== 'visible' && (
        <div>
          {review.moderationStatus === 'hidden' && (
            <Badge variant="outline" className="text-destructive">
              <EyeOff className="mr-1 size-3" /> Скрыт администратором
            </Badge>
          )}
          {review.moderationStatus === 'pending' && (
            <Badge variant="outline">
              <Clock className="mr-1 size-3" /> На модерации
            </Badge>
          )}
        </div>
      )}

      {review.spoiler ? (
        <details className="min-h-0 flex-1 overflow-y-auto">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Содержит спойлеры - показать
          </summary>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
            {review.body}
          </p>
        </details>
      ) : (
        // Длинный отзыв прокручивается внутри карточки: жест
        // горизонтальный, прокрутка вертикальная - они не спорят.
        <p className="min-h-0 flex-1 overflow-y-auto whitespace-pre-line text-sm leading-relaxed">
          {review.body}
        </p>
      )}

      {showReactions && summary && (
        <ReactionButtons
          targetType="review"
          targetId={review.id}
          isSignedIn={isSignedIn}
          initial={summary}
          signinHref={signinHref}
        />
      )}
    </div>
  );
}
