import { createSupabaseServerClient } from '@/lib/supabase/server';
import { encodeBookRef } from '@/lib/books/ref';
import type { ShelfStatus } from '@/lib/shelf/actions';

/**
 * Социальная часть личного кабинета: лента активности, читатели с
 * похожим вкусом, полки участников.
 *
 * Отдельная своя таблица ленты в схеме есть (activity_feed), но она
 * приватна для владельца и никто в нее не пишет. Собирать ленту из
 * существующих таблиц надежнее: не нужен второй путь записи, который
 * рано или поздно разойдется с реальными данными.
 */

/** Кого читает пользователь. Пусто - значит и ленте взяться неоткуда. */
async function getFolloweeIds(userId: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', userId);
  return ((data ?? []) as { followee_id: string }[]).map((r) => r.followee_id);
}

export interface FeedAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface FeedBook {
  title: string;
  authors: string | null;
  coverUrl: string | null;
  href: string | null;
}

export type ActivityKind = 'shelf' | 'review';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  at: string;
  author: FeedAuthor;
  book: FeedBook;
  /** Статус полки - только для kind = 'shelf'. */
  status?: ShelfStatus;
  /** Оценка 1-10, если есть. */
  rating?: number | null;
  /** Текст отзыва - только для kind = 'review'. */
  excerpt?: string | null;
}

interface ProfileEmbed {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface BookEmbed {
  id: string;
  title: string;
  authors: string | null;
  cover_url: string | null;
}

function toAuthor(p: ProfileEmbed | null): FeedAuthor | null {
  if (!p) return null;
  return {
    id: p.id,
    username: p.username,
    displayName: p.display_name,
    avatarUrl: p.avatar_url,
  };
}

function toBook(b: BookEmbed | null): FeedBook | null {
  if (!b) return null;
  return {
    title: b.title,
    authors: b.authors,
    coverUrl: b.cover_url,
    href: `/book/${encodeBookRef('local', b.id)}`,
  };
}

const FEED_LIMIT = 12;

/**
 * Лента активности тех, на кого подписан пользователь.
 *
 * Два источника - полки и отзывы - сливаются и сортируются по времени.
 * Каждый берем с запасом, потому что после слияния половина отвалится
 * по лимиту.
 */
export async function getActivityFeed(userId: string): Promise<ActivityItem[]> {
  const followees = await getFolloweeIds(userId);
  if (followees.length === 0) return [];

  const supabase = await createSupabaseServerClient();

  const [shelfRes, reviewRes] = await Promise.all([
    supabase
      .from('user_books')
      .select(
        'user_id, book_id, status, rating, updated_at, ' +
          'profiles(id, username, display_name, avatar_url), ' +
          'books(id, title, authors, cover_url)',
      )
      .in('user_id', followees)
      .order('updated_at', { ascending: false })
      .limit(FEED_LIMIT * 2),
    supabase
      .from('reviews')
      .select(
        'id, user_id, book_id, body, rating, created_at, ' +
          'profiles(id, username, display_name, avatar_url), ' +
          'books(id, title, authors, cover_url)',
      )
      .in('user_id', followees)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(FEED_LIMIT * 2),
  ]);

  const items: ActivityItem[] = [];

  for (const row of (shelfRes.data ?? []) as unknown as {
    user_id: string;
    book_id: string;
    status: ShelfStatus;
    rating: number | null;
    updated_at: string;
    profiles: ProfileEmbed | null;
    books: BookEmbed | null;
  }[]) {
    const author = toAuthor(row.profiles);
    const book = toBook(row.books);
    if (!author || !book) continue;
    items.push({
      id: `shelf:${row.user_id}:${row.book_id}`,
      kind: 'shelf',
      at: row.updated_at,
      author,
      book,
      status: row.status,
      rating: row.rating,
    });
  }

  for (const row of (reviewRes.data ?? []) as unknown as {
    id: string;
    body: string | null;
    rating: number | null;
    created_at: string;
    profiles: ProfileEmbed | null;
    books: BookEmbed | null;
  }[]) {
    const author = toAuthor(row.profiles);
    const book = toBook(row.books);
    if (!author || !book) continue;
    items.push({
      id: `review:${row.id}`,
      kind: 'review',
      at: row.created_at,
      author,
      book,
      rating: row.rating,
      excerpt: row.body?.slice(0, 240) ?? null,
    });
  }

  return items
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, FEED_LIMIT);
}

export interface SimilarReader {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  /** Сколько любимых жанров совпало. */
  sharedGenres: string[];
}

/**
 * Читатели с похожим вкусом - по пересечению любимых жанров.
 *
 * Тех, на кого уже подписан, и себя не показываем: подписаться на них
 * второй раз нельзя, а место в блоке они занимают.
 */
export async function getSimilarReaders(
  userId: string,
  genres: string[],
  limit = 6,
): Promise<SimilarReader[]> {
  if (genres.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const followees = await getFolloweeIds(userId);
  const exclude = [userId, ...followees];

  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, favorite_genres')
    .overlaps('favorite_genres', genres)
    .not('id', 'in', `(${exclude.join(',')})`)
    .limit(limit * 3);

  const rows = (data ?? []) as {
    id: string;
    username: string;
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    favorite_genres: string[] | null;
  }[];

  return rows
    .map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      bio: r.bio,
      avatarUrl: r.avatar_url,
      sharedGenres: (r.favorite_genres ?? []).filter((g) => genres.includes(g)),
    }))
    // Сначала те, у кого совпадений больше: это и есть «похожий вкус».
    .sort((a, b) => b.sharedGenres.length - a.sharedGenres.length)
    .slice(0, limit);
}

export interface MemberShelf {
  member: FeedAuthor;
  readCount: number;
  covers: { title: string; coverUrl: string | null; href: string }[];
}

/**
 * Полки участников - что читают другие.
 *
 * Группируем в приложении, а не в SQL: PostgREST не умеет GROUP BY, а
 * заводить представление ради четырех карточек - лишняя сущность.
 */
export async function getMemberShelves(
  userId: string,
  limit = 4,
): Promise<MemberShelf[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('user_books')
    .select(
      'user_id, status, updated_at, ' +
        'profiles(id, username, display_name, avatar_url), ' +
        'books(id, title, authors, cover_url)',
    )
    .eq('status', 'read')
    .neq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(120);

  const byMember = new Map<string, MemberShelf>();

  for (const row of (data ?? []) as unknown as {
    user_id: string;
    profiles: ProfileEmbed | null;
    books: BookEmbed | null;
  }[]) {
    const member = toAuthor(row.profiles);
    if (!member) continue;

    let entry = byMember.get(member.id);
    if (!entry) {
      entry = { member, readCount: 0, covers: [] };
      byMember.set(member.id, entry);
    }
    entry.readCount += 1;
    if (row.books && entry.covers.length < 5) {
      entry.covers.push({
        title: row.books.title,
        coverUrl: row.books.cover_url,
        href: `/book/${encodeBookRef('local', row.books.id)}`,
      });
    }
  }

  return Array.from(byMember.values())
    .sort((a, b) => b.readCount - a.readCount)
    .slice(0, limit);
}

export interface SuggestedBook {
  title: string;
  author: string | null;
  coverUrl: string | null;
  href: string | null;
}

/**
 * Подборка «рекомендуем вам».
 *
 * Сначала то, что уже подобрал AI-помощник: эти книги человек видел и
 * может к ним вернуться. Если он им ни разу не пользовался - показываем
 * то, что чаще всего кладут на полки в клубе.
 */
export async function getSuggestedBooks(
  userId: string,
  limit = 4,
): Promise<SuggestedBook[]> {
  const supabase = await createSupabaseServerClient();

  const { data: ai } = await supabase
    .from('ai_recommendations')
    .select('title, author, cover_url, book_ref')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  const fromAi = ((ai ?? []) as {
    title: string;
    author: string;
    cover_url: string | null;
    book_ref: string | null;
  }[]).map((r) => ({
    title: r.title,
    author: r.author,
    coverUrl: r.cover_url,
    href: r.book_ref ? `/book/${r.book_ref}` : null,
  }));

  if (fromAi.length > 0) return fromAi;

  const { data: popular } = await supabase
    .from('books')
    .select('id, title, authors, cover_url')
    .order('shelves_count', { ascending: false })
    .limit(limit);

  return ((popular ?? []) as BookEmbed[]).map((b) => ({
    title: b.title,
    author: b.authors,
    coverUrl: b.cover_url,
    href: `/book/${encodeBookRef('local', b.id)}`,
  }));
}

export interface MemberCard extends SimilarReader {
  /** Подписан ли текущий читатель на этого участника. */
  isFollowing: boolean;
}

/**
 * Все участники клуба - для страницы «Найти людей».
 *
 * Приватные профили сюда не попадают: их отсекает та же политика
 * доступа, что скрывает их и в остальном приложении.
 */
export async function getMembers(
  userId: string | null,
  limit = 60,
): Promise<MemberCard[]> {
  const supabase = await createSupabaseServerClient();
  const followees = userId ? await getFolloweeIds(userId) : [];
  const followeeSet = new Set(followees);

  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, favorite_genres')
    .order('display_name')
    .limit(limit);

  return ((data ?? []) as {
    id: string;
    username: string;
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    favorite_genres: string[] | null;
  }[])
    .filter((r) => r.id !== userId)
    .map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      bio: r.bio,
      avatarUrl: r.avatar_url,
      sharedGenres: r.favorite_genres ?? [],
      isFollowing: followeeSet.has(r.id),
    }));
}
