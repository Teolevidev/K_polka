import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Shield, Star, EyeOff, Clock, Check } from 'lucide-react';
import { getAdminContext } from '@/lib/admin/auth';
import {
  getReviewsForModeration,
  type ModerationStatus,
} from '@/lib/reviews/queries';
import { ModerationActions } from '@/components/reviews/moderation-actions';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Админка' };

interface AdminPageProps {
  searchParams: Promise<{ status?: string }>;
}

const FILTERS: { id: ModerationStatus | 'all'; label: string; icon: typeof Check }[] = [
  { id: 'all', label: 'Все', icon: Star },
  { id: 'pending', label: 'На модерации', icon: Clock },
  { id: 'visible', label: 'Одобрено', icon: Check },
  { id: 'hidden', label: 'Скрыто', icon: EyeOff },
];

const DATE_FMT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const admin = await getAdminContext();
  if (!admin) redirect('/');

  const { status } = await searchParams;
  const activeFilter: ModerationStatus | 'all' =
    status === 'visible' || status === 'pending' || status === 'hidden'
      ? status
      : 'all';

  const reviews = await getReviewsForModeration(activeFilter);

  return (
    <div className="container max-w-4xl space-y-6 py-6">
      <header className="flex flex-wrap items-center gap-3">
        <Shield className="size-6 text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold">Админка</h1>
          <p className="text-sm text-muted-foreground">
            Модерация публичных отзывов читателей
          </p>
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          Вы вошли как {admin.role}
        </span>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {FILTERS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={id === 'all' ? '/admin' : `/admin?status=${id}`}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              activeFilter === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>

      {reviews.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Нет отзывов для отображения
        </p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{r.author.displayName}</span>
                <span className="text-muted-foreground">@{r.author.username}</span>
                <span className="text-muted-foreground">·</span>
                <Link
                  href={r.book.href}
                  className="font-medium text-primary hover:underline"
                >
                  {r.book.title}
                </Link>
                {typeof r.rating === 'number' && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Star className="size-3 fill-accent text-accent" aria-hidden="true" />
                    {r.rating}/10
                  </span>
                )}
                <time className="ml-auto text-xs text-muted-foreground">
                  {DATE_FMT.format(new Date(r.createdAt))}
                </time>
              </div>

              <div className="mb-3 flex items-center gap-2">
                {r.moderationStatus === 'visible' && (
                  <Badge variant="secondary">
                    <Check className="mr-1 size-3" /> Одобрено
                  </Badge>
                )}
                {r.moderationStatus === 'pending' && (
                  <Badge variant="outline">
                    <Clock className="mr-1 size-3" /> На модерации
                  </Badge>
                )}
                {r.moderationStatus === 'hidden' && (
                  <Badge variant="outline" className="text-destructive">
                    <EyeOff className="mr-1 size-3" /> Скрыто
                  </Badge>
                )}
                {r.spoiler && <Badge variant="outline">Спойлер</Badge>}
              </div>

              <p className="mb-3 whitespace-pre-line text-sm leading-relaxed">
                {r.body}
              </p>

              <ModerationActions
                reviewId={r.id}
                currentStatus={r.moderationStatus}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
