import { createSupabaseServerClient } from '@/lib/supabase/server';
import { encodeBookRef } from '@/lib/books/ref';

export type ModerationStatus = 'visible' | 'pending' | 'hidden';

export interface ReviewWithAuthor {
  id: string;
  bookId: string;
  body: string;
  rating: number | null;
  spoiler: boolean;
  moderationStatus: ModerationStatus;
  createdAt: string;
  updatedAt: string;
  author: {
    userId: string;
    displayName: string;
    username: string;
  };
  isMine: boolean;
}

export interface ReviewForModeration extends ReviewWithAuthor {
  book: {
    title: string;
    authors: string[];
    href: string;
  };
}

interface ReviewJoinRow {
  id: string;
  user_id: string;
  book_id: string;
  body: string;
  rating: number | null;
  spoiler: boolean;
  moderation_status: ModerationStatus;
  created_at: string;
  updated_at: string;
  profiles: {
    display_name: string;
    username: string;
  } | null;
}

interface ReviewWithBookRow extends ReviewJoinRow {
  books: {
    title: string;
    authors: string | null;
    google_books_id: string | null;
    openlibrary_work_id: string | null;
  } | null;
}

function toReview(row: ReviewJoinRow, currentUserId: string | null): ReviewWithAuthor {
  return {
    id: row.id,
    bookId: row.book_id,
    body: row.body,
    rating: row.rating,
    spoiler: row.spoiler,
    moderationStatus: row.moderation_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      userId: row.user_id,
      displayName: row.profiles?.display_name ?? 'Читатель',
      username: row.profiles?.username ?? '',
    },
    isMine: row.user_id === currentUserId,
  };
}

const REVIEW_SELECT =
  'id, user_id, book_id, body, rating, spoiler, moderation_status, created_at, updated_at, ' +
  'profiles(display_name, username)';

const REVIEW_FOR_MODERATION_SELECT =
  REVIEW_SELECT +
  ', books(title, authors, google_books_id, openlibrary_work_id)';

/** Видимые отзывы на конкретную книгу (плюс собственный, даже если не visible). */
export async function getBookReviews(
  bookId: string,
  currentUserId: string | null,
): Promise<ReviewWithAuthor[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('reviews')
    .select(REVIEW_SELECT)
    .eq('book_id', bookId)
    .order('created_at', { ascending: false });

  return ((data ?? []) as unknown as ReviewJoinRow[]).map((r) =>
    toReview(r, currentUserId),
  );
}

/** Свой отзыв на книгу (для предзаполнения формы редактирования). */
export async function getMyReviewForBook(
  userId: string,
  bookId: string,
): Promise<ReviewWithAuthor | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('reviews')
    .select(REVIEW_SELECT)
    .eq('book_id', bookId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return null;
  return toReview(data as unknown as ReviewJoinRow, userId);
}

/** Все отзывы пользователя (его «блог»). */
export async function getUserReviews(
  userId: string,
  currentUserId: string | null,
): Promise<ReviewForModeration[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('reviews')
    .select(REVIEW_FOR_MODERATION_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return mapReviewsWithBook((data ?? []) as unknown as ReviewWithBookRow[], currentUserId);
}

/** Список отзывов для модерации (только админ/модератор). */
export async function getReviewsForModeration(
  status: ModerationStatus | 'all' = 'all',
): Promise<ReviewForModeration[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from('reviews')
    .select(REVIEW_FOR_MODERATION_SELECT)
    .order('created_at', { ascending: false })
    .limit(100);

  if (status !== 'all') {
    query = query.eq('moderation_status', status);
  }

  const { data } = await query;
  return mapReviewsWithBook((data ?? []) as unknown as ReviewWithBookRow[], null);
}

function bookHref(row: ReviewWithBookRow['books']): string {
  if (!row) return '#';
  if (row.google_books_id) {
    return `/book/${encodeBookRef('google', row.google_books_id)}`;
  }
  if (row.openlibrary_work_id) {
    return `/book/${encodeBookRef('openlibrary', row.openlibrary_work_id)}`;
  }
  return '#';
}

function mapReviewsWithBook(
  rows: ReviewWithBookRow[],
  currentUserId: string | null,
): ReviewForModeration[] {
  return rows.map((row) => ({
    ...toReview(row, currentUserId),
    book: {
      title: row.books?.title ?? '(без названия)',
      authors: row.books?.authors
        ? row.books.authors.split(', ').filter(Boolean)
        : [],
      href: bookHref(row.books ?? null),
    },
  }));
}
