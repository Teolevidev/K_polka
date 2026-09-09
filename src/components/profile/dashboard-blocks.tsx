import Link from 'next/link';
import { BookOpen, Plus, Users } from 'lucide-react';
import type {
  ActivityItem,
  MemberShelf,
  SimilarReader,
  SuggestedBook,
} from '@/lib/social/queries';
import type { ShelfStatus } from '@/lib/shelf/actions';
import { Avatar } from '@/components/profile/avatar';
import { FollowButton } from '@/components/profile/follow-button';
import { InviteFriend } from '@/components/profile/invite-friend';
import { BookCover } from '@/components/book/book-cover';
import { Button } from '@/components/ui/button';
import { plural } from '@/lib/utils';

/** Заголовок раздела кабинета. */
function BlockTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-xl leading-tight">{children}</h2>;
}

/**
 * Пунктирная рамка-приглашение.
 *
 * Пустой раздел не должен выглядеть как поломка: рамка сразу говорит,
 * что здесь появится и что для этого нажать.
 */
function DashedBox({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border p-6 text-center ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

/** Приглашение добавить первую книгу. */
export function AddBookBox() {
  return (
    <DashedBox>
      <Button asChild>
        <Link href="/search">
          <Plus className="size-4" />
          Добавить книгу
        </Link>
      </Button>
      <p className="text-xs text-muted-foreground">
        Найдите книгу в поиске или{' '}
        <Link href="/book/new" className="underline underline-offset-4">
          заведите ее вручную
        </Link>
      </p>
    </DashedBox>
  );
}

const STATUS_VERB: Record<ShelfStatus, string> = {
  reading: 'начал читать',
  read: 'прочитал',
  want: 'хочет прочесть',
  dropped: 'не будет читать',
};

/** Лента активности тех, на кого подписан читатель. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <section className="space-y-3">
        <BlockTitle>Что нового у других</BlockTitle>
        <DashedBox className="py-10">
          <Users className="size-8 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Пока пусто. Подпишитесь на других участников - и здесь появится,
            что они читают.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" asChild>
              <Link href="/people">Найти людей</Link>
            </Button>
            <InviteFriend />
          </div>
        </DashedBox>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <BlockTitle>Что нового у других</BlockTitle>
      <ul className="divide-y divide-border rounded-lg bg-secondary/50">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 p-4">
            <Link href={`/u/${item.author.username}`} className="shrink-0">
              <Avatar
                name={item.author.displayName}
                src={item.author.avatarUrl}
                size="sm"
              />
            </Link>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm leading-snug">
                <Link
                  href={`/u/${item.author.username}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {item.author.displayName}
                </Link>{' '}
                <span className="text-muted-foreground">
                  {item.kind === 'review'
                    ? 'написал отзыв на'
                    : STATUS_VERB[item.status ?? 'want']}
                </span>{' '}
                {item.book.href ? (
                  <Link
                    href={item.book.href}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {item.book.title}
                  </Link>
                ) : (
                  <span className="font-medium">{item.book.title}</span>
                )}
                {typeof item.rating === 'number' && (
                  <span className="text-muted-foreground">
                    {' '}
                    - оценка {item.rating}/10
                  </span>
                )}
              </p>
              {item.excerpt && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {item.excerpt}
                </p>
              )}
            </div>
            {item.book.coverUrl && (
              <div className="hidden w-10 shrink-0 sm:block">
                <BookCover src={item.book.coverUrl} title={item.book.title} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Читатели с похожим вкусом - с кнопкой подписки прямо в карточке. */
export function SimilarReaders({
  readers,
  hasGenres,
}: {
  readers: SimilarReader[];
  hasGenres: boolean;
}) {
  return (
    <section className="space-y-3">
      <BlockTitle>Похожий вкус</BlockTitle>

      {!hasGenres ? (
        <DashedBox>
          <p className="text-sm text-muted-foreground">
            Выберите любимые жанры - и мы найдем тех, кто читает то же самое.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/profile/edit">Выбрать жанры</Link>
          </Button>
        </DashedBox>
      ) : readers.length === 0 ? (
        <DashedBox>
          <p className="text-sm text-muted-foreground">
            Пока никто не совпал по жанрам. В клубе еще мало участников -
            позовите своих.
          </p>
          <InviteFriend />
        </DashedBox>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {readers.map((r) => (
            <li key={r.id} className="rounded-lg bg-secondary/50 p-4">
              <div className="flex items-start gap-3">
                <Link href={`/u/${r.username}`} className="shrink-0">
                  <Avatar name={r.displayName} src={r.avatarUrl} size="md" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/u/${r.username}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {r.displayName}
                  </Link>
                  <p className="text-xs text-muted-foreground">@{r.username}</p>
                  {r.bio && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {r.bio}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.sharedGenres.length}{' '}
                    {plural(
                      r.sharedGenres.length,
                      'общий жанр',
                      'общих жанра',
                      'общих жанров',
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <FollowButton
                  targetUserId={r.id}
                  isFollowing={false}
                  isSignedIn
                  username={r.username}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Полки участников: кто что уже прочитал. */
export function MemberShelves({ shelves }: { shelves: MemberShelf[] }) {
  if (shelves.length === 0) return null;

  return (
    <section className="space-y-3">
      <BlockTitle>Полки участников</BlockTitle>
      <ul className="space-y-3">
        {shelves.map(({ member, readCount, covers }) => (
          <li key={member.id} className="rounded-lg bg-secondary/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Avatar name={member.displayName} src={member.avatarUrl} size="sm" />
              <div className="min-w-0">
                <Link
                  href={`/u/${member.username}`}
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  {member.displayName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {readCount} {plural(readCount, 'книга', 'книги', 'книг')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {covers.map((c) => (
                <Link key={c.href} href={c.href} className="w-12 shrink-0">
                  <BookCover src={c.coverUrl} title={c.title} />
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Книги, которые стоит посмотреть. */
export function SuggestedBooks({ books }: { books: SuggestedBook[] }) {
  if (books.length === 0) return null;

  return (
    <section className="space-y-3">
      <BlockTitle>Рекомендуем вам</BlockTitle>
      <ul className="divide-y divide-border rounded-lg bg-secondary/50">
        {books.map((b, i) => {
          const row = (
            <div className="flex items-center gap-3 p-3">
              <div className="w-11 shrink-0">
                <BookCover src={b.coverUrl} title={b.title} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{b.title}</p>
                {b.author && (
                  <p className="truncate text-sm text-muted-foreground">
                    {b.author}
                  </p>
                )}
              </div>
            </div>
          );
          return (
            <li key={`${b.title}-${i}`}>
              {b.href ? (
                <Link href={b.href} className="block hover:bg-secondary">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        <BookOpen className="mr-1 inline size-3" aria-hidden="true" />
        Персональную подборку соберет AI-помощник на главной.
      </p>
    </section>
  );
}
