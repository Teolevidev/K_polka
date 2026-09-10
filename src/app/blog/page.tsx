import type { Metadata } from 'next';
import Link from 'next/link';
import { PenLine } from 'lucide-react';
import { getPublishedArticles } from '@/lib/articles/queries';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { PageHeader } from '@/components/layout/page-header';

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
  // Без настроенной базы страница просто пуста, а не падает с ошибкой
  // сервера: остальные разделы ведут себя именно так, а блог до сих пор
  // валился с 500.
  const articles = isSupabaseConfigured()
    ? await getPublishedArticles().catch(() => [])
    : [];

  return (
    <div>
      <PageHeader
        title="Что почитать у нас"
        subtitle="Колонки редактора и обзоры книг от команды Книжной полки."
      >
        <p className="inline-flex items-center gap-2 text-sm opacity-75">
          <PenLine className="size-4" aria-hidden="true" />
          Блог Книжной полки
        </p>
      </PageHeader>

      <div className="container max-w-3xl space-y-6 py-8">

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
    </div>
  );
}
