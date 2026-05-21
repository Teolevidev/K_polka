'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BookmarkPlus, BookOpen, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ShelfStatus = 'reading' | 'read' | 'want';

const SHELVES: { status: ShelfStatus; label: string; icon: typeof BookOpen }[] = [
  { status: 'want', label: 'Хочу прочесть', icon: BookmarkPlus },
  { status: 'reading', label: 'Читаю сейчас', icon: BookOpen },
  { status: 'read', label: 'Прочитано', icon: Check },
];

interface AddToShelfProps {
  /** Ссылка на книгу (encodeBookRef). */
  bookRef: string;
  /** Текущий статус книги у пользователя, если есть. */
  currentStatus?: ShelfStatus | null;
}

/**
 * Кнопка добавления книги на полку.
 *
 * Фаза 1: серверный экшен сохранения подключается вместе с БД и авторизацией.
 * Пока выбор статуса у неавторизованного пользователя ведёт на страницу входа.
 */
export function AddToShelf({ bookRef, currentStatus = null }: AddToShelfProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = SHELVES.find((s) => s.status === currentStatus);

  function choose(status: ShelfStatus) {
    setOpen(false);
    // TODO(Фаза 1 · авторизация): заменить на server action addToShelf()
    router.push(`/signin?next=/book/${bookRef}&intent=shelf:${status}`);
  }

  return (
    <div className="relative">
      <Button
        className="w-full sm:w-auto"
        variant={active ? 'secondary' : 'default'}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {active ? (
          <>
            <active.icon className="size-4" />
            {active.label}
          </>
        ) : (
          <>
            <BookmarkPlus className="size-4" />
            На полку
          </>
        )}
        <ChevronDown className="size-4 opacity-70" />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute z-20 mt-1 w-56 overflow-hidden rounded-md border border-border bg-popover shadow-lg"
        >
          {SHELVES.map(({ status, label, icon: Icon }) => (
            <button
              key={status}
              role="menuitem"
              onClick={() => choose(status)}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary',
                status === currentStatus && 'text-primary',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
