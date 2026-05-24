'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { BookmarkPlus, BookOpen, Check, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { addBookToShelf, type ShelfStatus } from '@/lib/shelf/actions';

const SHELVES: { status: ShelfStatus; label: string; icon: typeof BookOpen }[] = [
  { status: 'want', label: 'Хочу прочесть', icon: BookmarkPlus },
  { status: 'reading', label: 'Читаю сейчас', icon: BookOpen },
  { status: 'read', label: 'Прочитано', icon: Check },
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
          variant={active ? 'secondary' : 'default'}
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
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg"
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
