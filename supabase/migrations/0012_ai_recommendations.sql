-- Миграция 0012 — история AI-рекомендаций (для исключения повторов).
create table if not exists ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  author text not null,
  reasoning text not null,
  cover_url text,
  book_ref text,
  created_at timestamptz not null default now()
);
create index if not exists ai_recommendations_user_idx
  on ai_recommendations (user_id, created_at desc);

alter table ai_recommendations enable row level security;
drop policy if exists "ai_rec_own_read" on ai_recommendations;
create policy "ai_rec_own_read" on ai_recommendations for select
  using (user_id = auth.uid());
drop policy if exists "ai_rec_own_write" on ai_recommendations;
create policy "ai_rec_own_write" on ai_recommendations for insert
  with check (user_id = auth.uid());
