import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Star } from 'lucide-react';
import { decodeBookRef } from '@/lib/books/ref';
import { getBookByRef, SourceUnavailableError } from '@/lib/books/detail';
import type { NormalizedBook } from '@/lib/books/types';
import { SourceUnavailableNotice } from '@/components/book/source-unavailable-notice';
import { BookCover } from '@/components/book/book-cover';
import { SectionBand } from '@/components/layout/section-band';
import { AddToShelf } from '@/components/book/add-to-shelf';
import { BookDetails } from '@/components/book/book-details';
import { BookAvailabilityBlock } from '@/components/book/book-availability';
import { AuthorBlock, AuthorBlockSkeleton } from '@/components/book/author-block';
import { AuthorBooks, RelatedRowSkeleton } from '@/components/book/related-books';
import { plural } from '@/lib/utils';
import { localizeGenres } from '@/lib/books/genres';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser, createSupabaseServerClient } from '@/lib/supabase/server';
import { getShelfStatusByRef } from '@/lib/shelf/queries';
import { findCatalogBookIdByRef } from '@/lib/books/catalog';
import { getBookReviews, getMyReviewForBook } from '@/lib/reviews/queries';
import { ReviewsCarousel } from '@/components/reviews/reviews-carousel';
import { ReviewForm } from '@/components/reviews/review-form';
import { getReactionSummariesForTargets } from '@/lib/reactions';
import { BackButton } from '@/components/layout/back-button';

interface BookPageProps {
  params: Promise<{ ref: string }>;
}

type LoadResult =
  | { status: 'ok'; book: NormalizedBook }
  | { status: 'not-found' }
  | { status: 'source-unavailable'; source: string };

/**
 * Загружает книгу, различая три исхода: нашли, книги нет, источник
 * не ответил. Третий случай раньше сливался со вторым, и человек видел
 * «ссылка устарела» там, где просто отказал внешний API.
 */
async function loadBook(ref: string): Promise<LoadResult> {
  const decoded = decodeBookRef(ref);
  if (!decoded) return { status: 'not-found' };

  try {
    const book = await getBookByRef(decoded);
    return book ? { status: 'ok', book } : { status: 'not-found' };
  } catch (error) {
    if (error instanceof SourceUnavailableError) {
      return { status: 'source-unavailable', source: error.source };
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: BookPageProps): Promise<Metadata> {
  const { ref } = await params;
  const loaded = await loadBook(ref);
  if (loaded.status !== 'ok') return { title: 'Книга не найдена' };
  const { book } = loaded;
  return {
    title: book.title,
    description: book.description?.slice(0, 160) ?? `${book.title} - на Книжной полке`,
  };
}

export default async function BookPage({ params }: BookPageProps) {
  const { ref } = await params;
  const loaded = await loadBook(ref);

  // Источник не ответил — книга существует, просто мы её сейчас не достали.
  if (loaded.status === 'source-unavailable') {
    return <SourceUnavailableNotice source={loaded.source} />;
  }
  if (loaded.status === 'not-found') notFound();

  const { book } = loaded;

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

  const primaryAuthor = book.authors[0] ?? null;
  // Google отдает жанры путями BISAC на английском - показывать их как
  // есть на русской странице нельзя.
  const genres = localizeGenres(book.genres);

  return (
    <div>
      {/* Шапка книги - на фирменной зеленой ленте, как первый экран
          главной. Обложка, название и действие: все, ради чего сюда
          пришли. Текстовые блоки ниже остаются на светлом - читать
          длинное описание на плотном цвете тяжело. */}
      <SectionBand tone="forest" className="py-8 sm:py-10">
        <div className="mx-auto mb-3 max-w-4xl">
          <BackButton onBand />
        </div>
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-[180px_1fr] sm:gap-8">
          <div className="mx-auto w-36 space-y-3 sm:mx-0 sm:w-full">
            <BookCover
              src={book.coverUrl}
              title={book.title}
              author={book.authors[0]}
              size="l"
            />
            <AddToShelf
              bookRef={ref}
              isSignedIn={Boolean(user)}
              currentStatus={shelfStatus}
            />
          </div>

          <div className="space-y-4 text-cream">
            <div className="space-y-1.5">
              <h1 className="font-serif text-3xl leading-tight sm:text-4xl">
                {book.title}
              </h1>
              {book.subtitle && (
                <p className="text-lg opacity-80">{book.subtitle}</p>
              )}
              {book.authors.length > 0 && (
                <p className="text-base opacity-80">{book.authors.join(', ')}</p>
              )}
            </div>

            {/* Внешняя оценка. Подписываем источник: шкала у нас своя,
                1-10, и смешивать ее с чужой пятибалльной нельзя. */}
            {book.externalRating && (
              <p className="inline-flex items-center gap-1.5 text-sm opacity-90">
                <Star className="size-4 fill-current" aria-hidden="true" />
                <span className="font-medium">
                  {book.externalRating.average.toFixed(1)}
                </span>
                из 5 в Google Books, {book.externalRating.count}{' '}
                {plural(book.externalRating.count, 'оценка', 'оценки', 'оценок')}
              </p>
            )}

            {genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {genres.slice(0, 6).map((g) => (
                  <span
                    key={g}
                    className="rounded-lg bg-cream/15 px-2.5 py-1 text-xs font-medium"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </SectionBand>

      <div className="container max-w-4xl space-y-10 py-8 sm:py-10">
        <section className="space-y-2">
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
        </section>

      <BookDetails book={book} />

      <BookAvailabilityBlock availability={book.availability} />

      {/* Блоки ниже ходят во внешние источники. Каждый под своим Suspense:
          страница книги показывается сразу, а справка и соседние книги
          подъезжают по мере готовности и не задерживают друг друга. */}
      {primaryAuthor && (
        <Suspense fallback={<AuthorBlockSkeleton />}>
          <AuthorBlock name={primaryAuthor} />
        </Suspense>
      )}

      {primaryAuthor && (
        <Suspense fallback={<RelatedRowSkeleton title="Другие книги автора" />}>
          <AuthorBooks book={book} />
        </Suspense>
      )}

      {/* Отзывы */}
      <section className="space-y-5 border-t border-border pt-8">
        <h2 className="text-xl font-semibold">Отзывы</h2>
        <ReviewForm
          bookRef={ref}
          isSignedIn={Boolean(user)}
          initial={myReview}
        />
        <ReviewsCarousel
          reviews={reviews.filter((r) => !r.isMine)}
          emptyText="Будьте первым, кто оставит отзыв на эту книгу."
          reactionSummaries={reactionSummaries}
          isSignedIn={Boolean(user)}
          signinHref={`/signin?next=/book/${ref}`}
        />
      </section>
      </div>
    </div>
  );
}
