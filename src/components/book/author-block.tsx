import { ExternalLink } from 'lucide-react';
import { getAuthorInfo } from '@/lib/books/author';

/**
 * Блок «Автор»: фотография и краткая справка из Википедии.
 *
 * Источник указан явно и статья открыта ссылкой: справка находится по
 * имени, и хотя страницы неоднозначности мы отсеиваем, полностью
 * исключить полного тёзку нельзя - читатель должен видеть, откуда текст.
 */
export async function AuthorBlock({ name }: { name: string }) {
  const info = await getAuthorInfo(name);
  if (!info) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Автор</h2>
      <div className="flex gap-4 rounded-lg border border-border bg-secondary/40 p-4">
        {info.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.photoUrl}
            alt={`Фотография: ${info.name}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="size-20 shrink-0 rounded-md object-cover"
          />
        )}
        <div className="min-w-0 space-y-1.5">
          <p className="font-medium">{info.name}</p>
          <p className="text-sm leading-relaxed text-foreground/90">{info.summary}</p>
          {info.articleUrl && (
            <a
              href={info.articleUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {info.lang === 'ru' ? 'Википедия' : 'Википедия, английская'}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

/** Скелет на время загрузки справки. */
export function AuthorBlockSkeleton() {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Автор</h2>
      <div className="flex gap-4 rounded-lg border border-border bg-secondary/40 p-4">
        <div className="size-20 shrink-0 animate-pulse rounded-md bg-secondary" />
        <div className="w-full space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-secondary" />
          <div className="h-3 w-full animate-pulse rounded bg-secondary" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-secondary" />
        </div>
      </div>
    </section>
  );
}
