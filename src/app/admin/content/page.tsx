import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bot, AlertTriangle } from 'lucide-react';
import { getAdminContext } from '@/lib/admin/auth';
import { listJobs } from '@/lib/content/jobs';
import { JOB_KIND_LABEL, type ContentJobStatus } from '@/lib/content/types';
import { BackButton } from '@/components/layout/back-button';
import { Badge } from '@/components/ui/badge';
import { ContentQueueForm } from '@/components/admin/content-queue-form';
import { JobActions } from '@/components/admin/job-actions';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Контент-агент' };

/**
 * Очередь контент-агента.
 *
 * Страница отвечает на два вопроса: что агент сделал и на чем
 * споткнулся. Публикации здесь нет и не будет - готовые тексты ждут в
 * разделе «Статьи», и кнопку «опубликовать» нажимает человек.
 */

const STATUS_LABEL: Record<ContentJobStatus, string> = {
  queued: 'в очереди',
  running: 'выполняется',
  done: 'готово',
  failed: 'ошибка',
  cancelled: 'снято',
};

export default async function AdminContentPage() {
  const admin = await getAdminContext();
  if (!admin) redirect('/');

  // Очередь читается service_role-клиентом, поэтому пустой ответ здесь
  // означает «нет заданий», а не «нет прав»: права проверены выше.
  let jobs: Awaited<ReturnType<typeof listJobs>> = [];
  let loadError: string | null = null;
  try {
    jobs = await listJobs(60);
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'не удалось прочитать очередь';
  }

  const counts = jobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="container max-w-4xl space-y-6 py-6">
      <BackButton />

      <header className="flex flex-wrap items-center gap-3">
        <Bot className="size-6 text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold">Контент-агент</h1>
          <p className="text-sm text-muted-foreground">
            Заводит книги в каталог и готовит черновики текстов
          </p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin" className="text-primary hover:underline">
          ← Модерация
        </Link>
        <Link href="/admin/articles" className="text-primary hover:underline">
          Статьи
        </Link>
        <Link href="/admin/editorial" className="text-primary hover:underline">
          Выбор администратора
        </Link>
      </nav>

      <ContentQueueForm />

      {loadError && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {loadError}
        </p>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="font-medium">Очередь</h2>
          <p className="text-sm text-muted-foreground">
            {Object.entries(counts)
              .map(([status, n]) => `${STATUS_LABEL[status as ContentJobStatus]}: ${n}`)
              .join(', ') || 'пока пусто'}
          </p>
        </div>

        {jobs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Заданий нет. Поставьте первое - например, список книг по ISBN.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium">
                      {JOB_KIND_LABEL[job.kind]}
                    </span>
                    <StatusBadge status={job.status} />
                    {job.attempts > 1 && (
                      <span className="text-xs text-muted-foreground">
                        попыток: {job.attempts}
                      </span>
                    )}
                  </div>

                  <p className="truncate text-sm text-muted-foreground">
                    {describe(job.payload)}
                  </p>

                  {job.result?.summary ? (
                    <p className="text-sm">
                      {String(job.result.summary)}
                      {job.result.slug ? (
                        <Link
                          href="/admin/articles"
                          className="ml-2 text-primary hover:underline"
                        >
                          к черновику
                        </Link>
                      ) : null}
                    </p>
                  ) : null}

                  {Array.isArray(job.result?.warnings) &&
                    job.result.warnings.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        замечания: {(job.result.warnings as string[]).join(', ')}
                      </p>
                    )}

                  {job.error && (
                    <p className="text-sm text-destructive">{job.error}</p>
                  )}
                </div>

                <JobActions id={job.id} status={job.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: ContentJobStatus }) {
  return (
    <Badge
      variant={status === 'done' ? 'default' : 'outline'}
      className={cn(
        status === 'failed' && 'border-destructive/50 text-destructive',
        status === 'running' && 'border-primary/50 text-primary',
      )}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** Короткая подпись задания - то, что человек вводил руками. */
function describe(payload: Record<string, unknown>): string {
  const pick = (key: string) =>
    typeof payload[key] === 'string' ? (payload[key] as string) : null;

  const isbn = pick('isbn');
  if (isbn) return `ISBN ${isbn}`;

  const title = pick('title');
  const author = pick('author');
  if (title) return author ? `${title} - ${author}` : title;

  return pick('topic') ?? pick('theme') ?? pick('query') ?? pick('bookId') ?? '-';
}
