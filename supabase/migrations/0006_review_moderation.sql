-- ============================================================
--  Книжная полка — миграция 0006
--  Модерация отзывов: visible / pending / hidden + админ-политика.
--
--  Применять после 0005_reading_goal_target.sql.
-- ============================================================

alter table reviews
  add column if not exists moderation_status text not null default 'visible'
    check (moderation_status in ('visible', 'pending', 'hidden')),
  add column if not exists moderated_by uuid references profiles(id) on delete set null,
  add column if not exists moderated_at timestamptz;

create index if not exists reviews_moderation_idx
  on reviews (moderation_status, created_at desc);

-- Пересобираем политику чтения отзывов:
-- публично видны только статусом visible; автор видит свои всегда;
-- админ и модератор видят все отзывы для модерации.
drop policy if exists "reviews select" on reviews;
create policy "reviews select" on reviews for select using (
  (visibility = 'public' and moderation_status = 'visible')
  or user_id = auth.uid()
  or exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'moderator')
  )
);

-- Админ/модератор могут менять moderation_status любого отзыва.
drop policy if exists "reviews admin moderate" on reviews;
create policy "reviews admin moderate" on reviews for update using (
  exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'moderator')
  )
) with check (true);
