'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  BookmarkPlus,
  BookOpen,
  BookX,
  Check,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { addBookToShelf, type ShelfStatus } from '@/lib/shelf/actions';

const SHELVES: { status: ShelfStatus; label: string; icon: typeof BookOpen }[] = [
  { status: 'want', label: 'Хочу прочесть', icon: BookmarkPlus },
  { status: 'reading', label: 'Читаю сейчас', icon: BookOpen },
  { status: 'read', label: 'Прочитано', icon: Check },
  { status: 'dropped', label: 'Не буду читать', icon: BookX },
];

interface AddToShelfProps {
  /** Ссылка на книгу (encodeBookRef). */
  bookRef: string;
  /** Вошёл ли пользователь. */
  isSignedIn: boolean;
  /** Текущий статус книги на полке пользователя, если есть. */
  currentStatus?: ShelfStatus | null;
}

/** Кнопка добавления книги на полку с выбором статуса. */
export function AddToShelf({
  bookRef,
  isSignedIn,
  currentStatus = null,
}: AddToShelfProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ShelfStatus | null>(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const active = SHELVES.find((s) => s.status === status);

  function choose(next: ShelfStatus) {
    setOpen(false);
    setError(null);

    if (!isSignedIn) {
      router.push(`/signin?next=/book/${bookRef}`);
      return;
    }

    const prev = status;
    setStatus(next); // оптимистично
    startTransition(async () => {
      const res = await addBookToShelf(bookRef, next);
      if (!res.ok) {
        setStatus(prev);
        setError(res.error ?? 'Не удалось сохранить');
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Button
          className="w-full"
          // Кнопка стоит на зеленой ленте, поэтому обе заливки светлые:
          // темная таблетка на темно-зеленом почти не читается.
          variant={active ? 'secondary' : 'onBand'}
          onClick={() => setOpen((v) => !v)}
          disabled={pending}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : active ? (
            <active.icon className="size-4" />
          ) : (
            <BookmarkPlus className="size-4" />
          )}
          {active ? active.label : 'На полку'}
          <ChevronDown className="ml-auto size-4 opacity-70" />
        </Button>

        {open && (
          <div
            role="menu"
            // Цвет текста задаем явно: меню всплывает над зеленой
            // лентой и иначе наследует ее кремовый - белым по белому.
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
          >
            {SHELVES.map(({ status: s, label, icon: Icon }) => (
              <button
                key={s}
                role="menuitem"
                onClick={() => choose(s)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary',
                  s === status && 'text-primary',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
                {s === status && <Check className="ml-auto size-4" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {status && !error && (
        <p className="text-center text-xs text-muted-foreground">
          Книга на вашей полке
        </p>
      )}
      {error && <p className="text-center text-xs text-destructive">{error}</p>}
      {!isSignedIn && (
        <p className="text-center text-xs text-muted-foreground">
          Войдите, чтобы сохранять книги
        </p>
      )}
    </div>
  );
}
