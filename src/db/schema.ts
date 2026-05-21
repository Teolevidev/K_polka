/**
 * Схема базы данных (Drizzle ORM, PostgreSQL / Supabase).
 *
 * Фаза 1 покрывает ядро трекера: профили, каталог книг, полки,
 * сессии чтения, отзывы и геймификацию. Таблицы клуба и платежей
 * (subscriptions, payments, club_posts …) добавятся в Фазе 3 —
 * см. docs/design.md §4.5–4.6.
 *
 * Профиль ссылается на auth.users (управляется Supabase Auth).
 * RLS-политики задаются в SQL-миграции supabase/migrations.
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  smallint,
  boolean,
  date,
  timestamp,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/* ---------- Пользователи ---------- */

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // = auth.users.id
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  location: text('location'),
  website: text('website'),
  locale: text('locale').notNull().default('ru'),
  theme: text('theme').notNull().default('system'),
  isPrivate: boolean('is_private').notNull().default(false),
  role: text('role').notNull().default('user'), // user | moderator | admin
  subscriptionTier: text('subscription_tier').notNull().default('free'), // free | club
  subscriptionExpiresAt: timestamp('subscription_expires_at', { withTimezone: true }),
  readingGoalYear: integer('reading_goal_year'),
  readingGoalSetAt: timestamp('reading_goal_set_at', { withTimezone: true }),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastReadAt: date('last_read_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const follows = pgTable(
  'follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    followeeId: uuid('followee_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.followerId, t.followeeId] }),
    followeeIdx: index('follows_followee_idx').on(t.followeeId),
  }),
);

/* ---------- Каталог книг ---------- */

export const books = pgTable(
  'books',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    isbn13: text('isbn_13').unique(),
    isbn10: text('isbn_10'),
    googleBooksId: text('google_books_id'),
    openlibraryWorkId: text('openlibrary_work_id'),
    livelibId: text('livelib_id'),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    description: text('description'),
    coverUrl: text('cover_url'),
    pageCount: integer('page_count'),
    publishedDate: date('published_date'),
    language: text('language'),
    mediaType: text('media_type').notNull().default('book'), // book | audiobook | comic
    isAdult: boolean('is_adult').notNull().default(false), // метка 18+
    ratingsCount: integer('ratings_count').notNull().default(0),
    ratingsSum: integer('ratings_sum').notNull().default(0),
    reviewsCount: integer('reviews_count').notNull().default(0),
    shelvesCount: integer('shelves_count').notNull().default(0),
    dataSources: jsonb('data_sources').notNull().default('[]'),
    rawMetadata: jsonb('raw_metadata'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    langIdx: index('books_lang_idx').on(t.language),
    isbn13Idx: index('books_isbn13_idx').on(t.isbn13),
  }),
);

export const authors = pgTable(
  'authors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    openlibraryAuthorId: text('openlibrary_author_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: index('authors_name_idx').on(t.name),
  }),
);

export const bookAuthors = pgTable(
  'book_authors',
  {
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.bookId, t.authorId] }),
  }),
);

export const genres = pgTable('genres', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  nameRu: text('name_ru').notNull(),
  nameEn: text('name_en').notNull(),
});

export const bookGenres = pgTable(
  'book_genres',
  {
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    genreId: uuid('genre_id')
      .notNull()
      .references(() => genres.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.bookId, t.genreId] }),
  }),
);

/* ---------- Полки и связь пользователь ↔ книга ---------- */

export const userBooks = pgTable(
  'user_books',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    status: text('status').notNull(), // reading | read | want
    startedAt: date('started_at'),
    finishedAt: date('finished_at'),
    rating: smallint('rating'), // 1..10
    privateNotes: text('private_notes'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    pagesRead: integer('pages_read').notNull().default(0),
    reReads: integer('re_reads').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.bookId] }),
    statusIdx: index('user_books_status_idx').on(t.userId, t.status),
    finishedIdx: index('user_books_finished_idx').on(t.userId, t.finishedAt),
  }),
);

export const shelves = pgTable(
  'shelves',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    isPublic: boolean('is_public').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userSlug: uniqueIndex('shelves_user_slug_idx').on(t.userId, t.slug),
  }),
);

export const shelfBooks = pgTable(
  'shelf_books',
  {
    shelfId: uuid('shelf_id')
      .notNull()
      .references(() => shelves.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.shelfId, t.bookId] }),
  }),
);

export const readingSessions = pgTable(
  'reading_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    readOn: date('read_on').notNull(),
    pages: integer('pages'),
    minutes: integer('minutes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userDateIdx: index('reading_sessions_user_date_idx').on(t.userId, t.readOn),
  }),
);

/* ---------- Отзывы и комментарии ---------- */

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    title: text('title'),
    body: text('body').notNull(),
    rating: smallint('rating'), // 1..10
    spoiler: boolean('spoiler').notNull().default(false),
    visibility: text('visibility').notNull().default('public'), // public | followers | club
    likesCount: integer('likes_count').notNull().default(0),
    commentsCount: integer('comments_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userBook: uniqueIndex('reviews_user_book_idx').on(t.userId, t.bookId),
    bookIdx: index('reviews_book_idx').on(t.bookId),
  }),
);

export const reviewLikes = pgTable(
  'review_likes',
  {
    reviewId: uuid('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.reviewId, t.userId] }),
  }),
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    parentType: text('parent_type').notNull(), // review | post | comment
    parentId: uuid('parent_id').notNull(),
    body: text('body').notNull(),
    likesCount: integer('likes_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    parentIdx: index('comments_parent_idx').on(t.parentType, t.parentId),
  }),
);

/* ---------- Геймификация ---------- */

export const achievements = pgTable('achievements', {
  id: text('id').primaryKey(), // first_book, ten_books, streak_30 …
  nameRu: text('name_ru').notNull(),
  nameEn: text('name_en').notNull(),
  descriptionRu: text('description_ru'),
  descriptionEn: text('description_en'),
  icon: text('icon').notNull(),
  threshold: integer('threshold'),
  category: text('category'), // reading | social | club
});

export const userAchievements = pgTable(
  'user_achievements',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    achievementId: text('achievement_id')
      .notNull()
      .references(() => achievements.id, { onDelete: 'cascade' }),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.achievementId] }),
  }),
);

/* ---------- Лента и уведомления ---------- */

export const activityFeed = pgTable(
  'activity_feed',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // finished_book | review | follow
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userTimeIdx: index('activity_user_time_idx').on(t.userId, t.createdAt),
  }),
);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type Book = typeof books.$inferSelect;
export type UserBook = typeof userBooks.$inferSelect;
export type Shelf = typeof shelves.$inferSelect;
export type Review = typeof reviews.$inferSelect;
