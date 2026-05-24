import { createSupabaseServerClient } from '@/lib/supabase/server';
import { encodeBookRef, decodeBookRef } from '@/lib/books/ref';
import { type ReadingStats, emptyStats } from '@/lib/stats';
import type { ShelfStatus } from './actions';

export interface ShelfItem {
  bookId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  href: string;
  status: ShelfStatus;
  rating: number | null;
}

interface BookJoin {
  id: string;
  title: string;
  authors: string | null;
  cover_url: string | null;
  page_count: number | null;
  google_books_id: string | null;
  openlibrary_work_id: string | null;
}

interface UserBookRow {
  status: ShelfStatus;
  rating: number | null;
  finished_at: string | null;
  book_id: string;
  books: BookJoin | null;
}

/** Восстанавливает URL книги из идентификаторов источника. */
function bookHref(b: BookJoin): string {
  if (b.google_books_id) return `/book/${encodeBookRef('google', b.google_books_id)}`;
  if (b.openlibrary_work_id) {
    return `/book/${encodeBookRef('openlibrary', b.openlibrary_work_id)}`;
  }
  return `/book/${b.id}`;
}

function toShelfItem(row: UserBookRow): ShelfItem | null {
  const b = row.books;
  if (!b) return null;
  return {
    bookId: row.book_id,
    title: b.title,
    authors: b.authors ? b.authors.split(', ').filter(Boolean) : [],
    coverUrl: b.cover_url,
    href: bookHref(b),
    status: row.status,
    rating: row.rating,
  };
}

const BOOK_SELECT =
  'status, rating, finished_at, book_id, books(id, title, authors, cover_url, page_count, google_books_id, openlibrary_work_id)';

/** Все книги пользователя со всех полок. */
export async function getUserShelfBooks(userId: string): Promise<ShelfItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('user_books')
    .select(BOOK_SELECT)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  return ((data ?? []) as unknown as UserBookRow[])
    .map(toShelfItem)
    .filter((x): x is ShelfItem => x !== null);
}

/** Статус конкретной книги у пользователя (по UUID книги) или null. */
export async function getUserBookStatus(
  userId: string,
  bookId: string,
): Promise<ShelfStatus | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('user_books')
    .select('status')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle();
  return (data?.status as ShelfStatus | undefined) ?? null;
}

/** Статус книги у пользователя по ссылке источника (для страницы книги). */
export async function getShelfStatusByRef(
  userId: string,
  ref: string,
): Promise<ShelfStatus | null> {
  const decoded = decodeBookRef(ref);
  if (!decoded) return null;

  const column =
    decoded.source === 'google'
      ? 'google_books_id'
      : decoded.source === 'openlibrary'
        ? 'openlibrary_work_id'
        : null;
  if (!column) return null;

  const supabase = await createSupabaseServerClient();
  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq(column, decoded.sourceId)
    .maybeSingle();
  if (!book?.id) return null;

  const { data } = await supabase
    .from('user_books')
    .select('status')
    .eq('user_id', userId)
    .eq('book_id', book.id)
    .maybeSingle();
  return (data?.status as ShelfStatus | undefined) ?? null;
}

/** Считает статистику чтения пользователя. */
export async function getReadingStats(userId: string): Promise<ReadingStats> {
  const supabase = await createSupabaseServerClient();
  const year = new Date().getFullYear();
  const stats = emptyStats(year);

  const { data: rows } = await supabase
    .from('user_books')
    .select('status, rating, finished_at, books(page_count)')
    .eq('user_id', userId);

  const list = (rows ?? []) as unknown as {
    status: ShelfStatus;
    rating: number | null;
    finished_at: string | null;
    books: { page_count: number | null } | null;
  }[];

  let ratingSum = 0;
  let ratingCount = 0;
  for (const r of list) {
    if (r.status === 'read') {
      stats.totalRead += 1;
      stats.pagesRead += r.books?.page_count ?? 0;
      if (r.finished_at && r.finished_at.startsWith(String(year))) {
        stats.thisYear += 1;
      }
    }
    if (typeof r.rating === 'number') {
      ratingSum += r.rating;
      ratingCount += 1;
    }
  }
  stats.avgRating = ratingCount > 0 ? ratingSum / ratingCount : null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_streak, longest_streak, reading_goal_year, reading_goal_target')
    .eq('id', userId)
    .maybeSingle();

  if (profile) {
    stats.currentStreak = profile.current_streak ?? 0;
    stats.longestStreak = profile.longest_streak ?? 0;
    if (profile.reading_goal_year === year && profile.reading_goal_target) {
      stats.goalTarget = profile.reading_goal_target;
    }
  }

  return stats;
}
