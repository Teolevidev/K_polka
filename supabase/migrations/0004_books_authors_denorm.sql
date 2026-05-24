-- ============================================================
--  Книжная полка — миграция 0004
--  Денормализованный список авторов в books для быстрых карточек +
--  права на наполнение каталога авторизованными пользователями.
--
--  Применять после 0003_profile_fields.sql.
-- ============================================================

alter table books
  add column if not exists authors text not null default '';

-- Книги добавляются в каталог при добавлении на полку.
drop policy if exists "books insert by authenticated" on books;
create policy "books insert by authenticated"
  on books for insert to authenticated with check (true);

drop policy if exists "books update by authenticated" on books;
create policy "books update by authenticated"
  on books for update to authenticated using (true) with check (true);
