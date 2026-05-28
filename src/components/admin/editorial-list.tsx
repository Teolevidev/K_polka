'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { unmarkEditorialPick, rotateNow } from '@/lib/editorial/actions';
import type { EditorialPick } from '@/lib/editorial/queries';

interface EditorialListProps {
  picks: EditorialPick[];
  currentWeekMonday: string;
}

/** Список маркированных книг с кнопками снять и «обновить пятёрку». */
export function EditorialList({ picks, currentWeekMonday }: EditorialListProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [rotateMsg, setRotateMsg] = useState<string | null>(null);

  function remove(id: string) {
    if (!confirm('Снять признак «Выбор администратора» с книги?')) return;
    setError(null);
    startTransition(async () => {
      const res = await unmarkEditorialPick(id);
      if (!res.ok) setError(res.error ?? 'Ошибка');
      else router.refresh();
    });
  }

  function rotate() {
    setError(null);
    setRotateMsg(null);
    startTransition(async () => {
      const res = await rotateNow();
      if (!res.ok) setError(res.error ?? 'Ошибка');
      else {
        setRotateMsg(
          (res.count ?? 0) > 0
            ? `Закреплено ${res.count} книг(и) на эту неделю`
            : 'Нет новых книг для ротации',
        );
        router.refresh();
      }
    });
  }

  const pending2 = picks.filter((p) => p.featuredWeek === null);
  const thisWeek = picks.filter((p) => p.featuredWeek === currentWeekMonday);
  const past = picks.filter(
    (p) => p.featuredWeek && p.featuredWeek !== currentWeekMonday,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p>
            Эта неделя ({currentWeekMonday}):{' '}
            <strong>{thisWeek.length}</strong> из 5 книг.{' '}
            В очереди: <strong>{pending2.length}</strong>.
          </p>
          <p className="text-muted-foreground">
            Уже показывались: {past.length}. Эти книги в очередь не возвращаются,
            пока не снять и не отметить заново.
          </p>
        </div>
        <Button onClick={rotate} disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Обновить пятёрку
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {rotateMsg && <p className="text-sm text-primary">{rotateMsg}</p>}

      {picks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Пока ни одной книги не отмечено. Найдите книгу выше и нажмите «Отметить».
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {picks.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-3">
              {p.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.coverUrl}
                  alt=""
                  className="h-12 w-8 rounded object-cover"
                />
              ) : (
                <div className="h-12 w-8 rounded bg-secondary" />
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/book/${p.bookRef}`}
                  className="truncate text-sm font-medium hover:underline"
                >
                  {p.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">{p.authors}</p>
              </div>
              {p.featuredWeek === currentWeekMonday && (
                <Badge variant="default">На этой неделе</Badge>
              )}
              {p.featuredWeek === null && <Badge variant="secondary">В очереди</Badge>}
              {p.featuredWeek && p.featuredWeek !== currentWeekMonday && (
                <Badge variant="outline">Был {p.featuredWeek}</Badge>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove(p.id)}
                disabled={pending}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
