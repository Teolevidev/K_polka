'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Check, BookmarkPlus, Library } from 'lucide-react';
import { cn, plural } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BookCard } from '@/components/book/book-card';
import type { ShelfItem } from '@/lib/shelf/queries';
import type { ShelfStatus } from '@/lib/shelf/actions';

const TABS: { id: ShelfStatus; label: string; icon: typeof BookOpen }[] = [
  { id: 'reading', label: 'Читаю', icon: BookOpen },
  { id: 'want', label: 'Хочу прочесть', icon: BookmarkPlus },
  { id: 'read', label: 'Прочитано', icon: Check },
];

interface ShelfTabsProps {
  books: ShelfItem[];
}

/** Вкладки полок пользователя с реальными книгами из БД. */
export function ShelfTabs({ books }: ShelfTabsProps) {
  const [active, setActive] = useState<ShelfStatus>('reading');
  const visible = books.filter((b) => b.status === active);

  function count(status: ShelfStatus) {
    return books.filter((b) => b.status === status).length;
  }

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={active === id}
            onClick={() => setActive(id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
            <span className="text-xs tabular-nums opacity-70">{count(id)}</span>
          </button>
        ))}
      </div>

      {visible.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            {visible.length} {plural(visible.length, 'книга', 'книги', 'книг')}
          </p>
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {visible.map((b) => (
              <BookCard
                key={b.bookId}
                book={{
                  title: b.title,
                  authors: b.authors,
                  coverUrl: b.coverUrl,
                  href: b.href,
                  rating: b.rating,
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <Library className="size-10 text-muted-foreground/40" aria-hidden="true" />
          <div>
            <p className="font-medium">На этой полке пока пусто</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Найдите книгу и добавьте её сюда — она появится в этом разделе.
            </p>
          </div>
          <Button asChild>
            <Link href="/search">Найти книгу</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
