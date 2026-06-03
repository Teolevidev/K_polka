-- Миграция 0010 — статьи (блог), полиморфные реакции, голосовалки.
-- Применять после 0009_avatars_storage.sql. Полный текст — в репозитории
-- (тот же запрос, что выполнен через MCP при разработке).

-- Articles (admin/moderator only writes; reads — published or self/admin)
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text,
  body_md text not null,
  cover_url text,
  kind text not null default 'editorial' check (kind in ('editorial','review','other')),
  author_id uuid references profiles(id) on delete set null,
  related_book_ref text,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  views_count int not null default 0,
  comments_count int not null default 0,
  likes_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists articles_status_published_at_idx on articles (status, published_at desc);
alter table articles enable row level security;
drop policy if exists "articles_public_read" on articles;
create policy "articles_public_read" on articles for select using (
  status = 'published'
  or exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator'))
);
drop policy if exists "articles_admin_write" on articles;
create policy "articles_admin_write" on articles for all
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator')))
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator')));

-- Polymorphic reactions (like/dislike on reviews, comments, articles)
create table if not exists reactions (
  user_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('review','comment','article')),
  target_id uuid not null,
  kind text not null check (kind in ('like','dislike')),
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index if not exists reactions_target_idx on reactions (target_type, target_id);
alter table reactions enable row level security;
drop policy if exists "reactions_public_read" on reactions;
create policy "reactions_public_read" on reactions for select using (true);
drop policy if exists "reactions_manage_own" on reactions;
create policy "reactions_manage_own" on reactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Comments policies (use for both reviews and articles)
drop policy if exists "comments_public_read" on comments;
create policy "comments_public_read" on comments for select using (true);
drop policy if exists "comments_manage_own" on comments;
create policy "comments_manage_own" on comments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Polls + options + votes
create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  created_by uuid references profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open','closed')),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  label text not null,
  position int not null default 0
);
create index if not exists poll_options_poll_idx on poll_options (poll_id, position);
create table if not exists poll_votes (
  poll_id uuid not null references polls(id) on delete cascade,
  option_id uuid not null references poll_options(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table poll_votes enable row level security;
drop policy if exists "polls_public_read" on polls;
create policy "polls_public_read" on polls for select using (true);
drop policy if exists "polls_admin_write" on polls;
create policy "polls_admin_write" on polls for all
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator')))
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator')));
drop policy if exists "poll_options_public_read" on poll_options;
create policy "poll_options_public_read" on poll_options for select using (true);
drop policy if exists "poll_options_admin_write" on poll_options;
create policy "poll_options_admin_write" on poll_options for all
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator')))
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator')));
drop policy if exists "poll_votes_public_read" on poll_votes;
create policy "poll_votes_public_read" on poll_votes for select using (true);
drop policy if exists "poll_votes_manage_own" on poll_votes;
create policy "poll_votes_manage_own" on poll_votes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
