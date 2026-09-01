import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX, Plus } from 'lucide-react';
import { searchBooks } from '@/lib/books/search';
import { encodeBookRef } from '@/lib/books/ref';
import { detectQueryKind } from '@/lib/books/isbn';
import { SearchBar } from '@/components/layout/search-bar';
import { SearchResultsView } from '@/components/book/search-results-view';
import { Button } from '@/components/ui/button';
import { plural } from '@/lib/utils';

export const metadata: Metadata = { title: 'Поиск книг' };

interface SearchPageProps {
  searchParams: Promise<{ q?: string; all?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = '', all } = await searchParams;
  const query = q.trim();
  const hasQuery = query.length >= 2;
  const allScripts = all === '1';

  const data = hasQuery
    ? await searchBooks(query, { allScripts })
    : {
        query,
        results: [],
        respondedSources: [],
        failedSources: [],
        filteredByScript: false,
        hiddenByScript: 0,
      };

  const kind = detectQueryKind(query);

  return (
    <div className="container space-y-6 py-6">
      <div className="mx-auto max-w-xl space-y-2">
        <h1 className="text-2xl font-semibold">Поиск книг</h1>
        <SearchBar initialQuery={query} autoFocus={!hasQuery} />
        <p className="text-xs text-muted-foreground">
          Ищите по названию, автору или ISBN. Поиск понимает опечатки.
        </p>
      </div>

      {!hasQuery && (
        <p className="py-10 text-center text-muted-foreground">
          Введите запрос, чтобы найти книгу
        </p>
      )}

      {hasQuery && data.results.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <SearchX className="size-10 text-muted-foreground/50" aria-hidden="true" />
          <div>
            <p className="font-medium">По запросу «{query}» ничего не нашлось</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Попробуйте изменить запрос или добавьте книгу вручную
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/book/new">
              <Plus className="size-4" />
              Добавить вручную
            </Link>
          </Button>
        </div>
      )}

      {hasQuery && data.results.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {kind === 'isbn' ? 'Поиск по ISBN. ' : ''}
            Найдено {data.results.length}{' '}
            {plural(data.results.length, 'книга', 'книги', 'книг')}
          </p>

          <SearchResultsView
            books={data.results.map((book) => ({
              title: book.title,
              authors: book.authors,
              coverUrl: book.coverUrl,
              href: `/book/${encodeBookRef(book.source, book.sourceId)}`,
            }))}
          />

          {data.filteredByScript && data.hiddenByScript > 0 && (
            <p className="text-xs text-muted-foreground">
              Показаны книги с русскими названиями.{' '}
              <Link
                href={`/search?q=${encodeURIComponent(query)}&all=1`}
                className="underline underline-offset-4 hover:text-foreground"
              >
                Показать все {data.hiddenByScript} скрытых
              </Link>{' '}
              — переводы и записи в латинской транслитерации.
            </p>
          )}

          {allScripts && (
            <p className="text-xs text-muted-foreground">
              Показаны книги на всех языках.{' '}
              <Link
                href={`/search?q=${encodeURIComponent(query)}`}
                className="underline underline-offset-4 hover:text-foreground"
              >
                Только с русскими названиями
              </Link>
            </p>
          )}

          {data.failedSources.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Часть источников не ответила вовремя — результаты могут быть неполными.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
