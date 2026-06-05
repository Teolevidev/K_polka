'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Sparkles, Loader2, RefreshCw, BookOpen, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { recommendBook, type RecommendationResult } from '@/lib/ai/recommend';

interface RecommendationBlockProps {
  isSignedIn: boolean;
}

/** AI-блок: «Порекомендуй мне книгу» с Anthropic Claude. */
export function RecommendationBlock({ isSignedIn }: RecommendationBlockProps) {
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [pending, startTransition] = useTransition();

  function ask() {
    startTransition(async () => {
      const r = await recommendBook();
      setResult(r);
    });
  }

  return (
    <section className="container">
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-5 text-primary" aria-hidden="true" />
          <h2 className="font-serif text-lg font-semibold sm:text-xl">
            Подобрать книгу — для вас лично
          </h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          AI-помощник Книжной полки подбирает книгу на основе ваших любимых
          жанров, прочитанного и того, что популярно у других читателей.
        </p>

        {!result && (
          <Button onClick={ask} disabled={pending || !isSignedIn} size="lg">
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Порекомендуй мне книгу
          </Button>
        )}

        {!isSignedIn && !result && (
          <p className="mt-2 text-xs text-muted-foreground">
            <Link href="/signin?next=/" className="text-primary hover:underline">
              Войдите
            </Link>
            , чтобы получить персональную рекомендацию.
          </p>
        )}

        {result && !result.ok && (
          <RecommendationError result={result} onRetry={ask} pending={pending} />
        )}

        {result && result.ok && (
          <article className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <div className="mx-auto w-28 sm:mx-0 sm:w-full">
              {result.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={result.coverUrl}
                  alt=""
                  className="aspect-[2/3] w-full rounded-md object-cover ring-1 ring-border"
                />
              ) : (
                <div className="flex aspect-[2/3] w-full items-center justify-center rounded-md bg-secondary text-muted-foreground">
                  <BookOpen className="size-8" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <h3 className="font-serif text-xl font-semibold leading-tight">
                {result.title}
              </h3>
              <p className="text-sm text-muted-foreground">{result.author}</p>
              <p className="text-sm leading-relaxed">{result.reasoning}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                {result.bookRef && (
                  <Button variant="default" asChild size="sm">
                    <Link href={`/book/${result.bookRef}`}>
                      Открыть карточку
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={ask} disabled={pending}>
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Подумать ещё
                </Button>
              </div>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

function RecommendationError({
  result,
  onRetry,
  pending,
}: {
  result: RecommendationResult;
  onRetry: () => void;
  pending: boolean;
}) {
  const message = result.error ?? 'Ошибка';
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-md border border-accent/50 bg-accent/10 p-3 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" />
      <div className="min-w-0 flex-1 space-y-2">
        <p>{message}</p>
        {result.needs === 'genres' && (
          <Link
            href="/profile/edit"
            className="inline-block font-medium text-primary hover:underline"
          >
            Перейти в профиль и выбрать жанры →
          </Link>
        )}
        {result.needs === 'email' && (
          <p className="text-muted-foreground">
            Войдите ещё раз по ссылке из письма — это автоматически подтвердит почту.
          </p>
        )}
        {result.needs === 'api-key' && (
          <p className="text-muted-foreground">
            Администратор настроит ключ в ближайшее время. Эта функция требует подключения AI-сервиса.
          </p>
        )}
        {!result.needs && (
          <Button onClick={onRetry} disabled={pending} size="sm" variant="outline">
            Попробовать ещё раз
          </Button>
        )}
      </div>
    </div>
  );
}
