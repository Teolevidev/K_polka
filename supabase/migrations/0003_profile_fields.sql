-- ============================================================
--  Книжная полка — миграция 0003
--  Расширение профиля: контакты, демография, любимые жанры,
--  настройки ежедневных напоминаний.
--
--  Применять после 0002_editorial_picks.sql.
-- ============================================================

alter table profiles
  add column if not exists phone text,
  add column if not exists gender text
    check (gender in ('male', 'female', 'other')),
  add column if not exists birth_year int
    check (birth_year between 1900 and 2025),
  add column if not exists favorite_genres text[] not null default '{}',
  add column if not exists onboarded boolean not null default false,
  add column if not exists daily_reminder boolean not null default false,
  add column if not exists reminder_channel text not null default 'email'
    check (reminder_channel in ('email', 'telegram')),
  add column if not exists reminder_time time not null default '19:00',
  add column if not exists telegram_username text;
