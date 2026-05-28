'use client';

import { useState, useTransition } from 'react';
import { Search, Plus, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { markEditorialPick } from '@/lib/editorial/actions';
import { useRouter } from 'next/navigation';

interface SearchResult {
  ref: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
}

interface SearchResponse {
  results: SearchResult[];
}

/** Поиск книги и отметка её как «Выбор администратора». */
export function EditorialMarker() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [markedRef, setMarkedRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as SearchResponse;
      setResults(data.results ?? []);
    } catch {
      setError('Не удалось получить результаты');
    } finally {
      setSearching(false);
    }
  }

  function mark(ref: string) {
    setError(null);
    startTransition(async () => {
      const res = await markEditorialPick(ref);
      if (res.ok) {
        setMarkedRef(ref);
        setTimeout(() => setMarkedRef(null), 1500);
        router.refresh();
      } else {
        setError(res.error ?? 'Ошибка');
      }
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="font-serif text-lg font-semibold">Добавить книгу в подборку</h2>
      <p className="text-sm text-muted-foreground">
        Найдите книгу и нажмите «Отметить». Помеченные книги попадают в очередь
        и автоматически выходят на главную раз в неделю.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Название, автор или ISBN"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={searching || query.trim().length < 2}>
          {searching ? <Loader2 className="size-4 animate-spin" /> : 'Искать'}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {results.length > 0 && (
        <ul className="divide-y divide-border">
          {results.slice(0, 8).map((r) => (
            <li key={r.ref} className="flex items-center gap-3 py-2">
              {r.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.coverUrl}
                  alt=""
                  className="h-12 w-8 rounded object-cover"
                />
              ) : (
                <div className="h-12 w-8 rounded bg-secondary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.authors.join(', ')}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => mark(r.ref)}
                disabled={pending}
              >
                {markedRef === r.ref ? (
                  <Check className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                Отметить
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
