-- ============================================================
--  Книжная полка — миграция 0008
--  Достижения видны публично (бейджи на /u/[username]).
--  Пользователь сам разблокирует свои достижения (insert).
-- ============================================================

drop policy if exists "user_achievements own" on user_achievements;
drop policy if exists "user_achievements select" on user_achievements;
drop policy if exists "user_achievements insert own" on user_achievements;

create policy "user_achievements select" on user_achievements for select using (true);
create policy "user_achievements insert own" on user_achievements for insert
  with check (user_id = auth.uid());
