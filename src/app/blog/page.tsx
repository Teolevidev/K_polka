import type { Metadata } from 'next';
import Link from 'next/link';
import { PenLine } from 'lucide-react';
import { getPublishedArticles } from '@/lib/articles/queries';

export const metadata: Metadata = { title: 'Блог' };

const DATE_FMT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const KIND_LABEL: Record<string, string> = {
  editorial: 'Колонка редактора',
  review: 'Обзор',
  other: 'Заметка',
};

export default async function BlogPage() {
  const articles = await getPublishedArticles();

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      <header className="space-y-1">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <PenLine className="size-4" />
          Блог Книжной полки
        </div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Что почитать у нас</h1>
        <p className="text-sm text-muted-foreground">
          Колонки редактора и обзоры книг от команды Книжной полки.
        </p>
      </header>

      {articles.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          Пока статей нет. Заглядывайте позже.
        </p>
      ) : (
        <ul className="space-y-4">
          {articles.map((a) => (
            <li key={a.id}>
              <Link
                href={`/blog/${a.slug}`}
                className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="mb-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="rounded-full bg-secondary px-2 py-0.5">
                    {KIND_LABEL[a.kind] ?? a.kind}
                  </span>
                  {a.publishedAt && (
                    <time>{DATE_FMT.format(new Date(a.publishedAt))}</time>
                  )}
                  {a.authorName && (
                    <span>· {a.authorName}</span>
                  )}
                </div>
                <h2 className="text-lg font-semibold leading-tight sm:text-xl">
                  {a.title}
                </h2>
                {a.excerpt && (
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                    {a.excerpt}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
