'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Check, BookmarkPlus, FolderPlus, Library } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type TabId = 'reading' | 'read' | 'want' | 'custom';

const TABS: { id: TabId; label: string; icon: typeof BookOpen }[] = [
  { id: 'reading', label: 'Читаю', icon: BookOpen },
  { id: 'read', label: 'Прочитано', icon: Check },
  { id: 'want', label: 'Хочу прочесть', icon: BookmarkPlus },
  { id: 'custom', label: 'Мои полки', icon: FolderPlus },
];

/**
 * Вкладки полок пользователя.
 *
 * Фаза 1: вкладки и пустые состояния. Загрузка книг с полок подключается
 * вместе с серверными запросами к БД (таблица user_books).
 */
export function ShelfTabs() {
  const [active, setActive] = useState<TabId>('reading');

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
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <Library className="size-10 text-muted-foreground/40" aria-hidden="true" />
        <div>
          <p className="font-medium">Полка пока пуста</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Найдите книгу и добавьте её сюда — она появится в этом разделе.
          </p>
        </div>
        <Button asChild>
          <Link href="/search">Найти книгу</Link>
        </Button>
      </div>
    </div>
  );
}
