'use client';

import { useTransition } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { cancelJob, retryJob } from '@/lib/content/actions';

/**
 * Две кнопки на строке задания: повторить и снять.
 *
 * Клиентские они только ради состояния «идет запрос»: сами действия
 * серверные и роль проверяют у себя.
 */
export function JobActions({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();

  const canRetry = status === 'failed' || status === 'cancelled';
  const canCancel = status === 'queued' || status === 'running';

  if (!canRetry && !canCancel) return null;

  return (
    <div className="flex shrink-0 gap-1">
      {canRetry && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => void retryJob(id))}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          повторить
        </button>
      )}
      {canCancel && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => void cancelJob(id))}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive disabled:opacity-50"
        >
          <X className="size-3.5" aria-hidden="true" />
          снять
        </button>
      )}
    </div>
  );
}
