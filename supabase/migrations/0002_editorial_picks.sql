-- ============================================================
--  Книжная полка — миграция 0002
--  «Выбор администратора»: книги, отмеченные администратором
--  для блока на главной. Пятёрка ротируется раз в неделю.
--
--  Применять после 0001_init.sql.
-- ============================================================

create table if not exists editorial_picks (
  id uuid primary key default gen_random_uuid(),
  -- ссылка на книгу (encodeBookRef: source::sourceId)
  book_ref text not null unique,
  -- кэш данных для отображения (книги пока не в собственном каталоге)
  title text not null,
  authors text not null default '',
  cover_url text,
  marked_by uuid references profiles(id) on delete set null,
  -- понедельник недели, в которую книга показывалась в блоке.
  -- NULL = ещё ни разу не показывалась (кандидат на ротацию).
  featured_week date,
  created_at timestamptz not null default now()
);

create index if not exists editorial_picks_featured_week_idx
  on editorial_picks (featured_week);
create index if not exists editorial_picks_pending_idx
  on editorial_picks (created_at) where featured_week is null;

-- ---------- RLS ----------
alter table editorial_picks enable row level security;

-- Читать может кто угодно (нужно для главной страницы)
drop policy if exists "editorial_picks readable" on editorial_picks;
create policy "editorial_picks readable"
  on editorial_picks for select using (true);

-- Изменять — только администраторы
drop policy if exists "editorial_picks admin write" on editorial_picks;
create policy "editorial_picks admin write"
  on editorial_picks for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
--  Как назначить себя администратором:
--  выполни ОДИН раз после первого входа в приложение,
--  подставив свой email.
--
--    update profiles set role = 'admin'
--    where id = (select id from auth.users where email = 'ТВОЙ_EMAIL');
--
--  После этого по адресу /admin откроется панель администратора.
-- ============================================================
