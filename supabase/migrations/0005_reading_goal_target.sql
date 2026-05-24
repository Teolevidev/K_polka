-- ============================================================
--  Книжная полка — миграция 0005
--  Целевое число книг для годовой цели чтения.
--  reading_goal_year хранит календарный год, reading_goal_target — счёт.
--
--  Применять после 0004_books_authors_denorm.sql.
-- ============================================================

alter table profiles
  add column if not exists reading_goal_target int
    check (reading_goal_target is null or reading_goal_target between 1 and 1000);
