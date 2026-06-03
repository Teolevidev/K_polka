'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Send, Loader2, Trash2, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addComment, deleteComment, type CommentRow, type CommentParentType } from '@/lib/comments';

interface CommentThreadProps {
  parentType: CommentParentType;
  parentId: string;
  comments: CommentRow[];
  isSignedIn: boolean;
  signinHref: string;
}

const DATE_FMT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const QUICK_EMOJI = ['👍', '🔥', '❤️', '😂', '🤔', '👏'];

/** Список комментариев + форма добавления. */
export function CommentThread({
  parentType,
  parentId,
  comments,
  isSignedIn,
  signinHref,
}: CommentThreadProps) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    startTransition(async () => {
      const res = await addComment(parentType, parentId, body);
      if (!res.ok) setError(res.error ?? 'Ошибка');
      else {
        setBody('');
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!confirm('Удалить комментарий?')) return;
    startTransition(async () => {
      const res = await deleteComment(id);
      if (!res.ok) setError(res.error ?? 'Ошибка');
      else router.refresh();
    });
  }

  function appendEmoji(e: string) {
    setBody((prev) => prev + (prev.endsWith(' ') || !prev ? '' : ' ') + e + ' ');
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">
        Комментарии{' '}
        <span className="text-sm font-normal text-muted-foreground">
          ({comments.length})
        </span>
      </h3>

      {/* Форма */}
      {isSignedIn ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Что думаете?"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Smile className="size-4 text-muted-foreground" aria-hidden="true" />
              {QUICK_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => appendEmoji(e)}
                  className="rounded px-1.5 py-0.5 text-base hover:bg-secondary"
                >
                  {e}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={send}
              disabled={pending || body.trim().length === 0}
              className="ml-auto"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Отправить
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
          <Link href={signinHref} className="font-medium text-primary hover:underline">
            Войдите
          </Link>
          , чтобы оставить комментарий.
        </div>
      )}

      {/* Список */}
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Комментариев пока нет.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card p-3">
              <header className="mb-1 flex flex-wrap items-baseline gap-x-3 text-sm">
                {c.author.username ? (
                  <Link
                    href={`/u/${c.author.username}`}
                    className="font-medium hover:underline"
                  >
                    {c.author.displayName}
                    <span className="ml-1 text-xs text-muted-foreground">
                      @{c.author.username}
                    </span>
                  </Link>
                ) : (
                  <span className="font-medium">{c.author.displayName}</span>
                )}
                <time className="ml-auto text-xs text-muted-foreground">
                  {DATE_FMT.format(new Date(c.createdAt))}
                </time>
              </header>
              <p className="whitespace-pre-line text-sm leading-relaxed">{c.body}</p>
              {c.isMine && (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  disabled={pending}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3" /> Удалить
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
