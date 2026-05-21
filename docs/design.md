# «Книжная полка» — технический дизайн-документ

**Версия:** 1.1 (обновлено после первого ревью)
**Автор:** Claude
**Дата:** 2026-05-20
**Заказчик:** Teo (myteolevin@gmail.com)

**Что изменилось в v1.1:**
- Главная страница переработана под стиль Yandex Books (лента каруселей)
- Подробно описана fuzzy-архитектура поиска (опечатки в авторе/названии)
- Email-провайдер: Yandex Postbox вместо Resend
- Apple OAuth — за feature flag, активируем при появлении Apple Developer
- YooKassa — пишем код, на проде sandbox-ключ; реальный merchant включим позже
- Задел в БД под медиатипы (`book` | `audiobook` | `comic`) — даже если не используем сейчас
- Стартуем на `.vercel.app`-домене, кастомный домен подключим позже
- Логотип: wordmark на серифе

---

## 1. Краткое описание

«Книжная полка» — веб-приложение для трекинга прочитанных книг с социальным слоем (как Letterboxd для книг) и закрытым книжным клубом по подписке. Целевая аудитория: русскоязычные читатели (RU/CIS), с прицелом на международное расширение.

**Ключевая идея.** Пользователь приходит за тремя задачами: (а) вести личную библиотеку и статистику, (б) находить новые книги через поиск (ISBN/автор/название) и социальные сигналы, (в) делиться мнением и читать других. Платный клуб — слой поверх: приватные эссе, обсуждения, «книга месяца».

**Целевые метрики MVP:** время первого добавления книги после регистрации ≤ 60 сек; поиск книги — медиана ≤ 800 мс; LCP мобильного главного экрана ≤ 2.5 сек.

---

## 2. Тех-стек

| Слой | Решение | Почему |
|------|---------|--------|
| Фронтенд | **Next.js 15 (App Router) + React 19 + TypeScript** | SSR/RSC для SEO страниц книг, edge-runtime для быстрых API-роутов, mature экосистема |
| Стили | **Tailwind CSS 4 + shadcn/ui** | Быстрая разработка, две темы из коробки, доступность |
| БД и Auth | **Supabase (PostgreSQL 16)** | Auth + БД + Storage + RLS в одном; magic link и OAuth из коробки |
| ORM | **Drizzle ORM** | Типобезопасные миграции, легче чем Prisma, дружит с edge |
| i18n | **next-intl** | Лучшая поддержка App Router, server-side routing per locale |
| Состояние | **Zustand + TanStack Query** | Серверное состояние через React Query, локальное — Zustand |
| Формы | **react-hook-form + Zod** | Стандарт индустрии, общая Zod-схема для клиента и сервера |
| Платежи | **YooKassa SDK** (RU) | Тинькофф/Сбер как fallback; Stripe — задел для будущего |
| Email | **Resend** | Простой API, дёшево, отлично с magic link и транзакционкой |
| Файлы | **Supabase Storage** | Аватары, обложки кастомные, экспорт статистики |
| Полнотекстовый поиск | **PostgreSQL `pg_trgm` + `unaccent` + tsvector** | Достаточно для MVP; ElasticSearch — только при росте |
| Очереди | **Supabase Edge Functions + pg_cron** | Фоновые задачи: подтягивание метаданных, стрики, daily stats |
| Хостинг | **Vercel** (фронт + API routes) | Лучший DX для Next.js, edge network, бесплатный план потянет MVP |
| Мониторинг | **Sentry** (фронт+бэк) + **Vercel Analytics** + **PostHog** (продуктовая аналитика) | |
| CI/CD | **GitHub Actions** + **Vercel Preview Deployments** | PR → preview-окружение автоматом |
| Тесты | **Vitest** (unit) + **Playwright** (e2e) + **Storybook** (UI) | |

**Версии узловые:** Node 22 LTS, pnpm 9 (для монорепо), TypeScript 5.6 strict.

---

## 3. Архитектура высокого уровня

```
┌─────────────────────────────────────────────────────────────────┐
│                       Пользователь                              │
│            Браузер (мобильный/десктоп) + PWA                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Vercel Edge Network                           │
│         Next.js App Router (RSC + Server Actions)               │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │   Pages      │  │  API Routes  │  │   Server Actions    │    │
│  │  (RSC+SSR)   │  │ /api/books/* │  │  shelves/reviews    │    │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────┘    │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │                │                      │
          ▼                ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Supabase                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐     │
│  │PostgreSQL│  │   Auth   │  │ Storage  │  │Edge Functions│     │
│  │ + RLS    │  │OAuth/Mag │  │ (S3-like)│  │  (cron, hooks)│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼ Внешние API (с кешем в Postgres)
┌─────────────────────────────────────────────────────────────────┐
│  Google Books │ OpenLibrary │ ISBNdb │ LiveLib (scraper)        │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  YooKassa │ Resend │ Sentry │ PostHog                           │
└─────────────────────────────────────────────────────────────────┘
```

**Ключевые паттерны:**

- **Server Components по умолчанию.** Все списки (полки, отзывы, лента) рендерим на сервере — меньше JS на клиенте, лучше LCP.
- **Server Actions** для мутаций (добавить книгу на полку, написать отзыв) — типобезопасно, без лишних API-роутов.
- **Edge Runtime** для `/api/books/search` — низкая латентность поиска по миру.
- **RLS (Row Level Security)** в Postgres — основная защита. Клиент Supabase ходит с JWT юзера, БД сама проверяет права.

---

## 4. Схема базы данных

Полная нормализованная схема. Все таблицы — в схеме `public`, временные метки `created_at`/`updated_at` через триггер.

### 4.1 Пользователи и профили

```sql
-- auth.users живёт в Supabase, расширяем профилем
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique not null,         -- @handle
  display_name text not null,
  bio text,
  avatar_url text,
  location text,
  website text,
  locale text not null default 'ru',       -- 'ru' | 'en'
  theme text not null default 'system',    -- 'light' | 'dark' | 'system'
  is_private boolean not null default false,
  role text not null default 'user',       -- 'user' | 'moderator' | 'admin'
  subscription_tier text not null default 'free',  -- 'free' | 'club'
  subscription_expires_at timestamptz,
  reading_goal_year int,                   -- цель на текущий год
  reading_goal_set_at timestamptz,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_read_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table follows (
  follower_id uuid references profiles(id) on delete cascade,
  followee_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
```

### 4.2 Книги (каталог)

Каталог книг — общий для всех. Хранится в Postgres, обогащается из четырёх внешних API. Идентификатор — наш собственный UUID, внешние ID (google, openlibrary, isbn) — в отдельных колонках для поиска.

```sql
create table books (
  id uuid primary key default gen_random_uuid(),
  -- внешние ID для дедупликации и обогащения
  isbn_13 text unique,
  isbn_10 text,
  google_books_id text,
  openlibrary_work_id text,
  livelib_id text,
  -- основные поля
  title text not null,
  title_normalized text generated always as (
    lower(unaccent(title))
  ) stored,
  subtitle text,
  description text,
  cover_url text,
  page_count int,
  published_date date,
  language text,                            -- 'ru', 'en', ...
  -- агрегаты (обновляются триггерами)
  ratings_count int not null default 0,
  ratings_sum int not null default 0,
  reviews_count int not null default 0,
  shelves_count int not null default 0,    -- сколько раз попала на полки
  -- метаданные
  data_sources jsonb not null default '[]',  -- ['google_books', 'openlibrary']
  raw_metadata jsonb,                        -- сырые данные источников
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index books_title_trgm on books using gin (title_normalized gin_trgm_ops);
create index books_isbn13 on books (isbn_13) where isbn_13 is not null;
create index books_lang on books (language);

create table authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_normalized text generated always as (lower(unaccent(name))) stored,
  bio text,
  avatar_url text,
  openlibrary_author_id text,
  created_at timestamptz not null default now()
);

create unique index authors_name_normalized on authors (name_normalized);
create index authors_name_trgm on authors using gin (name_normalized gin_trgm_ops);

create table book_authors (
  book_id uuid references books(id) on delete cascade,
  author_id uuid references authors(id) on delete cascade,
  position smallint not null default 0,
  primary key (book_id, author_id)
);

create table genres (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_ru text not null,
  name_en text not null
);

create table book_genres (
  book_id uuid references books(id) on delete cascade,
  genre_id uuid references genres(id) on delete cascade,
  primary key (book_id, genre_id)
);
```

### 4.3 Полки и связь «пользователь ↔ книга»

```sql
create table user_books (
  user_id uuid references profiles(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  status text not null,                    -- 'reading' | 'read' | 'want'
  started_at date,
  finished_at date,
  rating smallint check (rating between 1 and 10),
  private_notes text,                       -- только для себя
  is_favorite boolean not null default false,
  pages_read int not null default 0,
  re_reads int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create index user_books_status on user_books (user_id, status);
create index user_books_finished_at on user_books (user_id, finished_at desc);

-- Кастомные полки
create table shelves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  is_public boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table shelf_books (
  shelf_id uuid references shelves(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (shelf_id, book_id)
);

-- Сессии чтения для стрика и графиков
create table reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  read_on date not null,
  pages int,
  minutes int,
  created_at timestamptz not null default now()
);

create index reading_sessions_user_date on reading_sessions (user_id, read_on desc);
```

### 4.4 Отзывы, рейтинги, комментарии

```sql
create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  title text,
  body text not null,
  rating smallint check (rating between 1 and 10),
  spoiler boolean not null default false,
  visibility text not null default 'public',  -- 'public' | 'followers' | 'club'
  likes_count int not null default 0,
  comments_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create table review_likes (
  review_id uuid references reviews(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  parent_type text not null,               -- 'review' | 'post' | 'comment'
  parent_id uuid not null,
  body text not null,
  likes_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_parent on comments (parent_type, parent_id, created_at);
```

### 4.5 Клуб (платная часть)

```sql
create table club_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete cascade,
  title text not null,
  slug text not null,
  body_md text not null,                   -- markdown
  cover_url text,
  status text not null default 'draft',    -- 'draft' | 'published'
  visibility text not null default 'club', -- 'club' | 'public-preview'
  related_book_id uuid references books(id),
  views_count int not null default 0,
  likes_count int not null default 0,
  comments_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (author_id, slug)
);

create table book_of_the_month (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references books(id),
  month date not null unique,              -- первое число месяца
  curator_id uuid references profiles(id),
  intro_post_id uuid references club_posts(id),
  created_at timestamptz not null default now()
);

create table club_discussions (
  id uuid primary key default gen_random_uuid(),
  book_of_the_month_id uuid references book_of_the_month(id) on delete cascade,
  title text not null,
  body_md text not null,
  created_at timestamptz not null default now()
);
```

### 4.6 Подписки и платежи

```sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  provider text not null,                  -- 'yookassa'
  provider_subscription_id text,
  status text not null,                    -- 'active' | 'pending' | 'cancelled' | 'past_due'
  plan text not null,                       -- 'monthly' | 'yearly'
  amount_rub int not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  subscription_id uuid references subscriptions(id),
  provider text not null,
  provider_payment_id text unique,
  amount_rub int not null,
  status text not null,                     -- 'pending' | 'succeeded' | 'failed' | 'refunded'
  payload jsonb,                            -- raw webhook data
  created_at timestamptz not null default now()
);
```

### 4.7 Геймификация

```sql
create table achievements (
  id text primary key,                     -- 'first_book', 'ten_books', 'streak_30'
  name_ru text not null,
  name_en text not null,
  description_ru text,
  description_en text,
  icon text not null,
  threshold int,
  category text                             -- 'reading' | 'social' | 'club'
);

create table user_achievements (
  user_id uuid references profiles(id) on delete cascade,
  achievement_id text references achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
```

### 4.8 Системные

```sql
create table activity_feed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text not null,        -- 'finished_book', 'review', 'follow', 'club_post'
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index activity_user_time on activity_feed (user_id, created_at desc);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id),
  target_type text not null,                -- 'review' | 'comment' | 'profile'
  target_id uuid not null,
  reason text not null,
  status text not null default 'open',      -- 'open' | 'reviewed' | 'dismissed'
  created_at timestamptz not null default now()
);
```

**Итого:** ~22 таблицы. Все ключевые мутации защищены RLS-политиками (детали в §6).

---

## 5. Интеграция с книжными API

### 5.1 Стратегия

Все четыре источника дают разное качество данных для разных книг. Решение: **federated search** с слиянием результатов и **прогрессивное обогащение** в фоне.

**Алгоритм поиска `/api/books/search?q=...`:**

1. Сначала ищем в локальной БД (`pg_trgm` по `title_normalized` и автору, exact match по ISBN).
2. Параллельно стучимся в Google Books и OpenLibrary с тайм-аутом 1.5 сек.
3. Если q похож на ISBN — добавляем ISBNdb (платный, бережём квоту).
4. Результаты дедуплицируем (по ISBN → title+author).
5. Записываем «находки» в `books` со статусом `data_sources` для последующего обогащения.
6. Если в результате есть кириллица и мало находок — асинхронно стучим в LiveLib (scraper).
7. Возвращаем смерженный список, ранжированный по релевантности (BM25 + наличие обложки + лайков на платформе).

### 5.2 Источники в деталях

**Google Books API.** Бесплатно до 1000 запросов/день без ключа, до 100 000 с ключом. Лучшие обложки, неплохие описания, англоязычные книги. Для русских — посредственно.
- Endpoint: `https://www.googleapis.com/books/v1/volumes?q=...`
- Поля: `title`, `authors`, `publishedDate`, `pageCount`, `imageLinks.thumbnail`, `industryIdentifiers`.
- Лимиты: бесплатный план Vercel-функций (1M вызовов/мес) хватит за глаза.

**OpenLibrary API.** Полностью бесплатно, без лимитов. Хорошие данные по более редким и старым книгам. Часто заполняет пробелы Google Books.
- Search: `https://openlibrary.org/search.json?q=...`
- Книга: `https://openlibrary.org/works/{id}.json`
- Обложки: `https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg`

**ISBNdb.** Платный (от $14.95/мес за Basic), но дает самые точные данные именно по ISBN. Подключаем как **третий источник, только когда q — это ISBN**. Кешируем агрессивно.

**LiveLib (scraping).** ⚠️ **Риск.** Официального API нет; нужно парсить HTML. План:
- Использовать **Playwright headless** на Vercel Edge или отдельном сервере (Vercel запрещает headless браузеры в serverless — выносим в отдельную **Supabase Edge Function** или Cloudflare Worker).
- Кешировать жёстко (TTL 30 дней) — каждую книгу скрапим максимум раз в месяц.
- Уважать `robots.txt` (по факту: запрещает много, что юридически серая зона — обсудим отдельно).
- Иметь kill-switch: если LiveLib блокирует / меняет вёрстку — отключаем через feature flag без падения остального.

**Альтернатива LiveLib:** русские книги из OpenLibrary (там их немало) + ручной импорт пользователями + опционально API «ЛитРес» (если получится подключить).

### 5.3 Кеширование

- Запросы к внешним API — кешируются в БД (`raw_metadata` в `books`).
- Поисковые ответы кешируются в Vercel Edge Cache (1 час для популярных запросов).
- ISBN-запросы кешируются навсегда (книга не меняется).

### 5.4 Фоновое обогащение

`pg_cron` каждый час:
- Берёт книги с `fetched_at < now() - interval '30 days'`.
- Обогащает данные из источников, которые ещё не использовались.
- Пересчитывает агрегаты (`ratings_count`, `reviews_count`).

---

## 6. Аутентификация и безопасность

### 6.1 Auth-флоу

Через **Supabase Auth**:
- **Magic link** (по email) — основной для большинства.
- **Google OAuth** — через Supabase Provider.
- **Apple OAuth** — Apple Sign In, требует Apple Developer аккаунта ($99/год).

После первого входа: онбординг (выбор @username, тема, цель года), пользователь попадает в БД через триггер `auth.users → public.profiles`.

### 6.2 Row Level Security

Все таблицы — `enable row level security`. Примеры политик:

```sql
-- profiles: читать можно публичные или себя
create policy "read public profiles"
  on profiles for select
  using (not is_private or id = auth.uid() or
         exists (select 1 from follows where follower_id = auth.uid() and followee_id = profiles.id));

-- user_books: писать может только владелец
create policy "manage own user_books"
  on user_books for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- club_posts: читать только подписчики
create policy "club content visible to subscribers"
  on club_posts for select
  using (
    visibility = 'public-preview' or
    exists (select 1 from profiles where id = auth.uid() and subscription_tier = 'club')
  );
```

### 6.3 Защита от ботов и спама

- **hCaptcha** на регистрации и при отправке отзывов первых 5 раз.
- **Rate limit** на server actions: 30 действий/мин на пользователя (через `@upstash/ratelimit`).
- **Зеркальный honeypot** на формах.
- На webhook YooKassa — проверка подписи.

### 6.4 GDPR / 152-ФЗ

- Экспорт данных пользователя (JSON-дамп всех его записей).
- Полное удаление аккаунта с каскадом.
- Политика конфиденциальности и согласие при регистрации.

---

## 7. Фичи по фазам

### Фаза 1 — Фундамент (1–2 недели разработки)

- Инициализация репо, CI/CD, окружения dev/preview/prod.
- Схема БД + миграции + сидинг базовых данных (жанры, достижения).
- Auth: magic link + Google OAuth + Apple OAuth. Онбординг.
- Профиль (просмотр, редактирование, аватар).
- Поиск книг (Google Books + OpenLibrary, кеш в БД).
- Страница книги (метаданные, список отзывов).
- Полки: 3 фиксированных + кастомные.
- Добавление книги на полку, удаление, перемещение, ручной ввод.
- Личная статистика: всего прочитано, в этом году, страниц, средний рейтинг.
- Светлая/тёмная темы.
- Базовая мобильная вёрстка.

**Итог Фазы 1:** работающий персональный трекер. Можно жить с ним и набирать первых пользователей.

### Фаза 2 — Социальный слой (1–2 недели)

- Отзывы и рейтинги (1–10), лайки, комментарии.
- Публичные профили (`/u/{username}`).
- Подписки на пользователей (follow).
- Лента «популярное» (страница `/discover`): топ книг недели/месяца.
- Цели чтения: год, прогресс-бар на дашборде.
- Стрики: дни подряд с записью прочитанного.
- Достижения: «10 книг», «месяц стрика», «5 жанров» и т.д.
- ISBN-сканер через камеру (PWA).

### Фаза 3 — Клуб и админ (2–3 недели)

- Подключение YooKassa: создание подписки, webhook, отмена.
- Платная страница `/club`: лендинг с описанием.
- Приватные блоги клуба (Markdown-редактор).
- Закрытые обсуждения.
- «Книга месяца»: страница с обсуждением, опрос на следующую.
- Расширенная статистика (для клубных): по жанрам, авторам, по годам, темп чтения, прогноз дочитывания.
- Админ-панель `/admin`: модерация отзывов, бан пользователей, «книга месяца», промо-коды, метрики.
- Email-уведомления о клубных активностях.

### Фаза 4 — Полировка (1 неделя)

- i18n EN: переводы интерфейса, локализация дат и чисел.
- PWA: манифест, service worker, push-уведомления.
- Деплой на прод, домен, мониторинг, аналитика.
- SEO: open graph, sitemap, robots.txt.
- Финальный UX-проход и e2e-тесты.

---

## 8. i18n: русский + английский

- Используем **next-intl** с динамической маршрутизацией: `/ru/...`, `/en/...`. По умолчанию `/ru`.
- Все строки UI — в `messages/ru.json` и `messages/en.json`.
- Локализация: даты (`date-fns/locale`), числа, plurals (Intl.PluralRules).
- Контент пользователей (отзывы, посты) — не переводим, отображаем как есть с пометкой языка.
- Метаданные книг — храним мультиязычно (например, описание берётся из источника, ближайшего к локали пользователя).

---

## 9. Платежи (YooKassa)

**Тарифы (предложение к обсуждению):**

| Тариф | Цена | Что включено |
|-------|------|--------------|
| Free | 0 ₽ | Трекер, поиск, публичные отзывы, базовая статистика |
| Club (Monthly) | 390 ₽/мес | Всё + приватные блоги клуба, закрытые обсуждения, «книга месяца», бейдж клуба |
| Club (Yearly) | 3 900 ₽/год | Месячный × 12 со скидкой 17% |

**Флоу:**

1. Пользователь жмёт «Оформить клуб» → выбор плана.
2. Создаём платёж через YooKassa Checkout (redirect или встроенная форма).
3. Пользователь платит → YooKassa шлёт webhook на `/api/webhooks/yookassa`.
4. Проверяем подпись, обновляем `subscriptions` и `profiles.subscription_tier = 'club'`.
5. На рекуррентные списания тот же webhook.

**Промо-коды:** таблица `promo_codes`, скидка на первый период, ограничения по сроку и кол-ву.

---

## 10. Админ-панель

Маршрут `/admin`, доступ только для `role in ('moderator', 'admin')`.

**Разделы:**

- **Дашборд:** DAU, MAU, новые регистрации, активные подписки, MRR.
- **Пользователи:** поиск, фильтр по тиру/роли, бан/анбан, просмотр активности.
- **Контент:** ревью отзывов и постов с жалобами, удаление с уведомлением автору.
- **Каталог книг:** ручное редактирование метаданных, мерж дублей, заливка обложек.
- **Клуб:** управление «книгой месяца», публикация клубных постов, расписание встреч.
- **Промо-коды:** создание и выдача.
- **Логи:** последние webhook'и YooKassa, ошибки Sentry-агрегированно.

Под капотом — те же RLS, плюс отдельная маршрутизация и audit-лог действий админа.

---

## 11. PWA и мобайл

- **Manifest:** иконки 192/512, theme color (зависит от темы), display: standalone.
- **Service Worker:** через `next-pwa` (или workbox), стратегии:
  - HTML: network-first с fallback.
  - Статика (JS/CSS/изображения): stale-while-revalidate.
  - Обложки книг: cache-first c TTL 7 дней.
- **Offline-режим:** последние 50 страниц книг + текущая полка — доступны офлайн на чтение.
- **Push-уведомления:** через Web Push API (для подписчиков клуба — новые посты «книги месяца»).
- **iOS-нюансы:** push на iOS требует Safari 16.4+ и установки на домашний экран. Apple Login на iOS — отдельный SDK.
- **Mobile UX:** bottom navigation, jumbo touch targets, нативный шеринг через `navigator.share`, ISBN-сканер через `getUserMedia` + `@zxing/library`.

---

## 12. DevOps и деплой

**Окружения:**
- **Dev:** локально (Docker-compose с Supabase локально или ngrok-туннель в облако).
- **Preview:** автоматически на каждый PR (Vercel Preview + отдельная Supabase ветка через `supabase db branch`).
- **Production:** main → авто-деплой на Vercel + миграции через `supabase db push`.

**Секреты:** Vercel Environment Variables + Doppler (опционально) для синхронизации.

**Бэкапы:** Supabase делает ежедневные снимки (на платных планах). Дополнительно — `pg_dump` в Supabase Storage раз в неделю.

**Мониторинг:**
- Sentry для ошибок (фронт + сервер).
- Vercel Analytics для производительности.
- PostHog для продуктовой аналитики (funnels, retention).
- Uptime — Better Stack или встроенный Vercel.

---

## 13. Оценка стоимости (месячная, до 5 000 MAU)

| Сервис | План | Цена/мес |
|--------|------|----------|
| Vercel | Pro (для commercial) | $20 |
| Supabase | Pro | $25 |
| Resend | Pro (50k email) | $20 |
| Sentry | Team | $26 |
| PostHog | Hobby (1M events) | $0 |
| ISBNdb | Basic | $15 |
| Домен .ru | — | ~$3 |
| YooKassa | 3.5% с оборота | — |
| Apple Dev | — | $99/год ≈ $8 |
| **Итого** | | **≈ $117/мес** |

На фриплане Vercel + Supabase Free + Resend Free можно стартовать с **$0**, но до первых 100 активных пользователей — потом упрутся лимиты.

При выходе на 50 000 MAU потребуется Supabase Team ($599/мес) или вынос на собственный Postgres.

---

## 14. Роадмап и сроки

Реалистичные сроки при работе ~30 ч/нед (один разработчик уровня senior + Claude):

| Этап | Срок | Что в результате |
|------|------|------------------|
| Фаза 1 | 2 недели | Локально работающий трекер, поиск, полки, статистика |
| Фаза 2 | 2 недели | Социалка, отзывы, цели, стрики, ачивки |
| Фаза 3 | 3 недели | Клуб, YooKassa, админка |
| Фаза 4 | 1 неделя | i18n EN, PWA, прод-деплой, мониторинг |
| **Итого** | **~8 недель** | Полноценное MVP в продакшене |

После запуска: 2–4 недели на стабилизацию и итерации по обратной связи первых пользователей.

---

## 15. Риски и митигации

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| LiveLib блокирует/меняет HTML | Высокая | Feature flag, kill switch, переход на OpenLibrary для RU |
| YooKassa требует юрлицо/самозанятого | Высокая | Открыть самозанятого до Фазы 3, или CloudPayments как fallback |
| Apple Developer регистрация занимает 1–2 недели | Средняя | Начать сразу, в Фазе 1 запустить только Google OAuth + magic link |
| Google Books rate-limit | Низкая | Кеш + ключ API; OpenLibrary как primary для бесплатных квот |
| Падение Supabase | Низкая | Ежедневные бекапы, RPO 24 часа |
| Юридические вопросы по скрейпингу LiveLib | Средняя | Использовать только публичные данные, не агрессивно, готовность отключить |
| Спам в отзывах | Средняя | hCaptcha, rate limit, модерация жалоб |
| Низкая конверсия в клуб | Высокая | A/B-тест цен, бесплатный пробный месяц, эксклюзивный контент |

---

## 16. Открытые вопросы к Teo

Прежде чем стартовать Фазу 1, нужны решения:

1. **Apple Developer аккаунт.** У тебя уже есть? Если нет — Apple OAuth уберём из Фазы 1 и подключим в Фазе 4 (займёт 2 недели на регистрацию).
2. **Юрлицо/самозанятый для YooKassa.** Есть? Если нет — оформим самозанятого к Фазе 3.
3. **Цены подписки.** 390 ₽/мес и 3 900 ₽/год — норм или другие цифры?
4. **«Книга месяца».** Кто её выбирает в MVP — ты единолично или голосование клуба?
5. **Хранилище репозитория.** Заведём приватный GitHub-репозиторий? Под твоим аккаунтом?
6. **Аналитика прочитанности страниц.** Пользователь руками отмечает «прочитал 50 страниц сегодня», или достаточно даты начала/конца?
7. **Импорт из Goodreads/LiveLib.** Нужно ли CSV-импорт уже в MVP, чтобы переезжать с других сервисов? (Рекомендую — это аргумент «зачем переходить».)
8. **Логотип и бренд.** Есть наработки или мне предложить 3–4 варианта?

---

## 17. Что я делаю в Фазе 1 после подтверждения

1. Создаю репозиторий и базовую структуру Next.js.
2. Поднимаю локальный Supabase, пишу все миграции и сидинг.
3. Реализую auth (magic link + Google OAuth + опционально Apple).
4. Делаю поиск книг с реальными API (Google Books + OpenLibrary).
5. Делаю страницу книги, добавление на полку, базовую статистику.
6. Делаю переключение тем и базовую мобильную вёрстку.
7. Локальное тестирование, e2e-сценарий «зарегистрировался → нашёл книгу → добавил → отметил прочитанной → увидел в статистике».
8. Готовлю инструкцию по подключению Supabase и развёртыванию на Vercel (тебе нужно будет создать аккаунты и передать ключи).

После Фазы 1 показываю работающее приложение → твоё ревью → Фаза 2.

---

**Дальше:** жду твои ответы по открытым вопросам §16 и команду «поехали». После этого начинаю код.
