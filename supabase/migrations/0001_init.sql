-- ============================================================
--  Книжная полка — миграция 0001 (инициализация схемы)
--
--  Применять в Supabase: SQL Editor → вставить → Run,
--  либо `supabase db push` через Supabase CLI.
--
--  Эта миграция — источник истины для БД: помимо таблиц она
--  создаёт расширения, RLS-политики и триггеры, которые
--  Drizzle-схема (src/db/schema.ts) не выражает. Структура таблиц
--  совпадает с Drizzle-схемой — та используется для типобезопасных
--  запросов из кода.
-- ============================================================

-- ---------- Расширения ----------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";       -- триграммный fuzzy-поиск
create extension if not exists "unaccent";      -- снятие диакритики
create extension if not exists "fuzzystrmatch"; -- levenshtein()
create extension if not exists "citext";        -- регистронезависимые строки

-- ---------- Утилита: обновление updated_at ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
--  ПОЛЬЗОВАТЕЛИ
-- ============================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique not null,
  display_name text not null,
  bio text,
  avatar_url text,
  location text,
  website text,
  locale text not null default 'ru',
  theme text not null default 'system',
  is_private boolean not null default false,
  role text not null default 'user',
  subscription_tier text not null default 'free',
  subscription_expires_at timestamptz,
  reading_goal_year int,
  reading_goal_set_at timestamptz,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_read_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Автосоздание профиля при регистрации пользователя
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_username text;
begin
  base_username := split_part(new.email, '@', 1);
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    -- гарантируем уникальность username
    base_username || '_' || substr(new.id::text, 1, 6),
    coalesce(new.raw_user_meta_data->>'full_name', base_username)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create table if not exists follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  followee_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on follows (followee_id);

-- ============================================================
--  КАТАЛОГ КНИГ
-- ============================================================

create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  isbn_13 text unique,
  isbn_10 text,
  google_books_id text,
  openlibrary_work_id text,
  livelib_id text,
  title text not null,
  -- нормализованное название для fuzzy-поиска
  title_normalized text generated always as (lower(unaccent(title))) stored,
  subtitle text,
  description text,
  cover_url text,
  page_count int,
  published_date date,
  language text,
  media_type text not null default 'book',
  is_adult boolean not null default false,
  ratings_count int not null default 0,
  ratings_sum int not null default 0,
  reviews_count int not null default 0,
  shelves_count int not null default 0,
  data_sources jsonb not null default '[]',
  raw_metadata jsonb,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists books_title_trgm
  on books using gin (title_normalized gin_trgm_ops);
create index if not exists books_lang_idx on books (language);

create trigger books_updated_at
  before update on books
  for each row execute function set_updated_at();

create table if not exists authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_normalized text generated always as (lower(unaccent(name))) stored,
  bio text,
  avatar_url text,
  openlibrary_author_id text,
  created_at timestamptz not null default now()
);
create index if not exists authors_name_trgm
  on authors using gin (name_normalized gin_trgm_ops);

create table if not exists book_authors (
  book_id uuid not null references books(id) on delete cascade,
  author_id uuid not null references authors(id) on delete cascade,
  position smallint not null default 0,
  primary key (book_id, author_id)
);

create table if not exists genres (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_ru text not null,
  name_en text not null
);

create table if not exists book_genres (
  book_id uuid not null references books(id) on delete cascade,
  genre_id uuid not null references genres(id) on delete cascade,
  primary key (book_id, genre_id)
);

-- ============================================================
--  ПОЛКИ И СВЯЗЬ ПОЛЬЗОВАТЕЛЬ ↔ КНИГА
-- ============================================================

create table if not exists user_books (
  user_id uuid not null references profiles(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  status text not null check (status in ('reading', 'read', 'want')),
  started_at date,
  finished_at date,
  rating smallint check (rating between 1 and 10),
  private_notes text,
  is_favorite boolean not null default false,
  pages_read int not null default 0,
  re_reads int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
create index if not exists user_books_status_idx on user_books (user_id, status);
create index if not exists user_books_finished_idx on user_books (user_id, finished_at desc);

create trigger user_books_updated_at
  before update on user_books
  for each row execute function set_updated_at();

create table if not exists shelves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  is_public boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists shelf_books (
  shelf_id uuid not null references shelves(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (shelf_id, book_id)
);

create table if not exists reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  read_on date not null,
  pages int,
  minutes int,
  created_at timestamptz not null default now()
);
create index if not exists reading_sessions_user_date_idx
  on reading_sessions (user_id, read_on desc);

-- ============================================================
--  ОТЗЫВЫ И КОММЕНТАРИИ
-- ============================================================

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  title text,
  body text not null,
  rating smallint check (rating between 1 and 10),
  spoiler boolean not null default false,
  visibility text not null default 'public'
    check (visibility in ('public', 'followers', 'club')),
  likes_count int not null default 0,
  comments_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);
create index if not exists reviews_book_idx on reviews (book_id);

create trigger reviews_updated_at
  before update on reviews
  for each row execute function set_updated_at();

create table if not exists review_likes (
  review_id uuid not null references reviews(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  parent_type text not null check (parent_type in ('review', 'post', 'comment')),
  parent_id uuid not null,
  body text not null,
  likes_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists comments_parent_idx on comments (parent_type, parent_id, created_at);

create trigger comments_updated_at
  before update on comments
  for each row execute function set_updated_at();

-- ============================================================
--  ГЕЙМИФИКАЦИЯ
-- ============================================================

create table if not exists achievements (
  id text primary key,
  name_ru text not null,
  name_en text not null,
  description_ru text,
  description_en text,
  icon text not null,
  threshold int,
  category text
);

create table if not exists user_achievements (
  user_id uuid not null references profiles(id) on delete cascade,
  achievement_id text not null references achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ============================================================
--  ЛЕНТА И УВЕДОМЛЕНИЯ
-- ============================================================

create table if not exists activity_feed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists activity_user_time_idx
  on activity_feed (user_id, created_at desc);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================

alter table profiles          enable row level security;
alter table follows           enable row level security;
alter table books             enable row level security;
alter table authors           enable row level security;
alter table book_authors      enable row level security;
alter table genres            enable row level security;
alter table book_genres       enable row level security;
alter table user_books        enable row level security;
alter table shelves           enable row level security;
alter table shelf_books       enable row level security;
alter table reading_sessions  enable row level security;
alter table reviews           enable row level security;
alter table review_likes      enable row level security;
alter table comments          enable row level security;
alter table achievements      enable row level security;
alter table user_achievements enable row level security;
alter table activity_feed     enable row level security;
alter table notifications     enable row level security;

-- Каталог (книги, авторы, жанры) — читают все, пишет только сервис
create policy "books readable by all"   on books   for select using (true);
create policy "authors readable by all" on authors for select using (true);
create policy "genres readable by all"  on genres  for select using (true);
create policy "book_authors readable"   on book_authors for select using (true);
create policy "book_genres readable"    on book_genres  for select using (true);
create policy "achievements readable"   on achievements for select using (true);

-- Профили: видны публичные, свой собственный и тех, на кого подписан
create policy "profiles select" on profiles for select using (
  not is_private
  or id = auth.uid()
  or exists (
    select 1 from follows
    where follower_id = auth.uid() and followee_id = profiles.id
  )
);
create policy "profiles update own" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Подписки: видит участник, управляет подписчик
create policy "follows select" on follows for select
  using (follower_id = auth.uid() or followee_id = auth.uid());
create policy "follows manage own" on follows for all
  using (follower_id = auth.uid()) with check (follower_id = auth.uid());

-- user_books: полный доступ только владельцу
create policy "user_books own" on user_books for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Полки: публичные видны всем, приватные — владельцу; правит владелец
create policy "shelves select" on shelves for select
  using (is_public or user_id = auth.uid());
create policy "shelves manage own" on shelves for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "shelf_books select" on shelf_books for select using (
  exists (
    select 1 from shelves s
    where s.id = shelf_books.shelf_id
      and (s.is_public or s.user_id = auth.uid())
  )
);
create policy "shelf_books manage own" on shelf_books for all using (
  exists (
    select 1 from shelves s
    where s.id = shelf_books.shelf_id and s.user_id = auth.uid()
  )
);

-- Сессии чтения — приватны
create policy "reading_sessions own" on reading_sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Отзывы: публичные видны всем; правит автор
create policy "reviews select" on reviews for select
  using (visibility = 'public' or user_id = auth.uid());
create policy "reviews manage own" on reviews for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "review_likes select" on review_likes for select using (true);
create policy "review_likes manage own" on review_likes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "comments select" on comments for select using (true);
create policy "comments manage own" on comments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Достижения, лента, уведомления — приватны для владельца
create policy "user_achievements own" on user_achievements for select
  using (user_id = auth.uid());
create policy "activity own" on activity_feed for select
  using (user_id = auth.uid());
create policy "notifications own" on notifications for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
--  СИДИНГ: жанры и достижения
-- ============================================================

insert into genres (slug, name_ru, name_en) values
  ('fiction',       'Художественная литература', 'Fiction'),
  ('nonfiction',    'Нон-фикшн',                 'Non-fiction'),
  ('fantasy',       'Фэнтези',                   'Fantasy'),
  ('scifi',         'Научная фантастика',        'Science fiction'),
  ('detective',     'Детективы',                 'Mystery & detective'),
  ('romance',       'Романтика',                 'Romance'),
  ('thriller',      'Триллеры',                  'Thriller'),
  ('classics',      'Классика',                  'Classics'),
  ('biography',     'Биографии и мемуары',       'Biography & memoir'),
  ('business',      'Бизнес',                    'Business'),
  ('psychology',    'Психология',                'Psychology'),
  ('history',       'История',                   'History'),
  ('science',       'Наука',                     'Science'),
  ('selfhelp',      'Саморазвитие',              'Self-help'),
  ('poetry',        'Поэзия',                    'Poetry'),
  ('children',      'Детская литература',        'Children''s books'),
  ('comics',        'Комиксы и манга',           'Comics & manga'),
  ('horror',        'Ужасы',                     'Horror')
on conflict (slug) do nothing;

insert into achievements (id, name_ru, name_en, description_ru, description_en, icon, threshold, category) values
  ('first_book',  'Первая книга',  'First book',   'Добавьте первую прочитанную книгу', 'Add your first finished book',  'BookMarked', 1,   'reading'),
  ('books_10',    '10 книг',       '10 books',     'Прочитайте 10 книг',                'Read 10 books',                  'Library',    10,  'reading'),
  ('books_25',    '25 книг',       '25 books',     'Прочитайте 25 книг',                'Read 25 books',                  'Library',    25,  'reading'),
  ('books_50',    '50 книг',       '50 books',     'Прочитайте 50 книг',                'Read 50 books',                  'Trophy',     50,  'reading'),
  ('books_100',   '100 книг',      '100 books',    'Прочитайте 100 книг',               'Read 100 books',                 'Trophy',     100, 'reading'),
  ('streak_7',    'Неделя подряд', '7-day streak', 'Читайте 7 дней подряд',             'Read 7 days in a row',           'Flame',      7,   'reading'),
  ('streak_30',   'Месяц подряд',  '30-day streak','Читайте 30 дней подряд',            'Read 30 days in a row',          'Flame',      30,  'reading'),
  ('goal_reached','Цель года',     'Yearly goal',  'Достигните годовой цели чтения',    'Reach your yearly reading goal', 'Target',     null,'reading'),
  ('first_review','Первый отзыв',  'First review', 'Напишите первый отзыв',             'Write your first review',        'PenLine',    1,   'social'),
  ('genres_5',    'Разносторонний','5 genres',     'Прочитайте книги 5 разных жанров',  'Read books from 5 genres',       'Shapes',     5,   'reading')
on conflict (id) do nothing;
