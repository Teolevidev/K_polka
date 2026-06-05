import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { decodeBookRef } from '@/lib/books/ref';
import { getBookByRef } from '@/lib/books/detail';
import { BookCover } from '@/components/book/book-cover';
import { AddToShelf } from '@/components/book/add-to-shelf';
import { Badge } from '@/components/ui/badge';
import { plural } from '@/lib/utils';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser, createSupabaseServerClient } from '@/lib/supabase/server';
import { getShelfStatusByRef } from '@/lib/shelf/queries';
import { findCatalogBookIdByRef } from '@/lib/books/catalog';
import { getBookReviews, getMyReviewForBook } from '@/lib/reviews/queries';
import { ReviewList } from '@/components/reviews/review-list';
import { ReviewForm } from '@/components/reviews/review-form';
import { getReactionSummariesForTargets } from '@/lib/reactions';

interface BookPageProps {
  params: Promise<{ ref: string }>;
}

async function loadBook(ref: string) {
  const decoded = decodeBookRef(ref);
  if (!decoded) return null;
  return getBookByRef(decoded);
}

export async function generateMetadata({
  params,
}: BookPageProps): Promise<Metadata> {
  const { ref } = await params;
  const book = await loadBook(ref);
  if (!book) return { title: 'Книга не найдена' };
  return {
    title: book.title,
    description: book.description?.slice(0, 160) ?? `${book.title} — на Книжной полке`,
  };
}

export default async function BookPage({ params }: BookPageProps) {
  const { ref } = await params;
  const book = await loadBook(ref);
  if (!book) notFound();

  const user = isSupabaseConfigured() ? await getCurrentUser() : null;
  const shelfStatus = user ? await getShelfStatusByRef(user.id, ref) : null;

  // Отзывы: ищем книгу в каталоге; если её ещё нет — отзывов нет, форма создаст.
  const supabase = isSupabaseConfigured() ? await createSupabaseServerClient() : null;
  const catalogBookId = supabase
    ? await findCatalogBookIdByRef(supabase, ref)
    : null;
  const reviews = catalogBookId
    ? await getBookReviews(catalogBookId, user?.id ?? null)
    : [];
  const myReview =
    user && catalogBookId ? await getMyReviewForBook(user.id, catalogBookId) : null;

  // Реакции (лайк/дизлайк) под каждым отзывом
  const reviewIds = reviews.map((r) => r.id);
  const reactionSummaries = reviewIds.length
    ? await getReactionSummariesForTargets('review', reviewIds)
    : {};

  const meta: { label: string; value: string }[] = [];
  if (book.publishedDate) meta.push({ label: 'Год издания', value: book.publishedDate });
  if (book.pageCount)
    meta.push({
      label: 'Объём',
      value: `${book.pageCount} ${plural(book.pageCount, 'страница', 'страницы', 'страниц')}`,
    });
  if (book.isbn13) meta.push({ label: 'ISBN', value: book.isbn13 });
  if (book.language) meta.push({ label: 'Язык', value: book.language.toUpperCase() });

  return (
    <div className="container max-w-4xl py-6 sm:py-10">
      <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:gap-8">
        {/* Обложка + действия */}
        <div className="mx-auto w-40 space-y-3 sm:mx-0 sm:w-full">
          <BookCover src={book.coverUrl} title={book.title} />
          <AddToShelf
            bookRef={ref}
            isSignedIn={Boolean(user)}
            currentStatus={shelfStatus}
          />
        </div>

        {/* Информация */}
        <div className="space-y-5">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              {book.title}
            </h1>
            {book.subtitle && (
              <p className="text-lg text-muted-foreground">{book.subtitle}</p>
            )}
            {book.authors.length > 0 && (
              <p className="text-base text-muted-foreground">
                {book.authors.join(', ')}
              </p>
            )}
          </div>

          {book.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {book.genres.slice(0, 6).map((g) => (
                <Badge key={g} variant="secondary">
                  {g}
                </Badge>
              ))}
            </div>
          )}

          {meta.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              {meta.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Описание</h2>
            {book.description ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {book.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Описание пока не добавлено.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Отзывы */}
      <section className="mt-10 space-y-5 border-t border-border pt-8">
        <h2 className="text-xl font-semibold">Отзывы</h2>
        <ReviewForm
          bookRef={ref}
          isSignedIn={Boolean(user)}
          initial={myReview}
        />
        <ReviewList
          reviews={reviews.filter((r) => !r.isMine)}
          emptyText="Будьте первым, кто оставит отзыв на эту книгу."
          reactionSummaries={reactionSummaries}
          isSignedIn={Boolean(user)}
          signinHref={`/signin?next=/book/${ref}`}
        />
      </section>
    </div>
  );
}
