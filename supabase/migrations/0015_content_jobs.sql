-- ============================================================
--  Книжная полка - миграция 0015
--  Очередь заданий контент-агента.
--
--  Агент не пишет на сайт напрямую. Он берет задание из этой
--  очереди, выполняет его и оставляет результат черновиком:
--  книга попадает в каталог, текст - в articles со status='draft'.
--  Публикует человек.
--
--  Зачем очередь, а не просто крон «раз в день напиши статью»:
--   - идемпотентность. Упало на середине - перезапустится то же
--     задание, а не появится вторая статья про ту же книгу;
--   - ретраи с выдержкой, без ручного присмотра;
--   - видимость. В админке видно, что агент сделал и на чем споткнулся;
--   - дозирование. Функция на Vercel живет ограниченное время, и за
--     один тик берется столько заданий, сколько успеется.
--
--  Применять после 0014_user_books_public_read.sql.
-- ============================================================

create table if not exists content_jobs (
  id uuid primary key default gen_random_uuid(),

  -- Что делать:
  --   ingest_book - найти книгу во внешних источниках и завести в каталог
  --   review      - редакционная рецензия на книгу (черновик статьи)
  --   longread    - лонгрид по теме (черновик статьи)
  --   roundup     - подборка из книг, уже лежащих в каталоге
  kind text not null check (kind in ('ingest_book', 'review', 'longread', 'roundup')),

  -- Вход задания: isbn, название с автором, тема, угол зрения.
  -- Форма зависит от kind и разбирается в src/lib/content/types.ts.
  payload jsonb not null default '{}'::jsonb,

  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),

  -- Что получилось: id книги или статьи, заголовок, slug.
  result jsonb,
  error text,

  attempts int not null default 0,
  max_attempts int not null default 3,

  -- Не раньше этого момента. Ретрай отодвигает время вперед, чтобы
  -- упавшее задание не крутилось в цикле, занимая тик за тиком.
  run_after timestamptz not null default now(),

  -- Ключ повтора. Одна и та же книга, поставленная в очередь дважды,
  -- второй раз просто не встанет. Пусто - повторы разрешены.
  dedupe_key text unique,

  -- Кто поставил задание. Пусто - поставил сам агент или скрипт.
  created_by uuid references profiles(id) on delete set null,

  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Индекс под выборку очередного задания: «queued, время пришло, по старшинству».
create index if not exists content_jobs_pending_idx
  on content_jobs (run_after) where status = 'queued';

create index if not exists content_jobs_created_idx
  on content_jobs (created_at desc);

create or replace trigger content_jobs_updated_at
  before update on content_jobs
  for each row execute function set_updated_at();

-- ---------- Выдача задания ----------
--
-- Два одновременных прогона (крон и запущенный руками скрипт) не должны
-- взять одно задание дважды. Отсюда `for update skip locked`: второй
-- прогон не ждет первого и не видит его строку, а берет следующую.
--
-- security definer, потому что RLS на таблице включен, а функция должна
-- уметь переводить задание в работу. Право на вызов есть только у
-- service_role - см. revoke ниже.
create or replace function claim_content_job()
returns content_jobs
language plpgsql security definer set search_path = public as $$
declare
  claimed content_jobs;
begin
  select * into claimed
    from content_jobs
   where status = 'queued'
     and run_after <= now()
   order by created_at
   for update skip locked
   limit 1;

  if not found then
    return null;
  end if;

  update content_jobs
     set status = 'running',
         attempts = attempts + 1,
         started_at = now()
   where id = claimed.id
   returning * into claimed;

  return claimed;
end;
$$;

-- Право вызова - только у агента.
--
-- Отзыв у PUBLIC снимает право со ВСЕХ ролей разом, включая
-- service_role: по умолчанию execute на функцию дается именно через
-- PUBLIC, своего гранта у service_role нет. Без явного grant ниже
-- агент не смог бы взять ни одного задания, и очередь молча стояла бы.
revoke execute on function claim_content_job() from public;
revoke execute on function claim_content_job() from anon;
revoke execute on function claim_content_job() from authenticated;
grant execute on function claim_content_job() to service_role;

-- ---------- RLS ----------
alter table content_jobs enable row level security;

-- Очередь - служебная кухня: читает ее только админ, в админке.
-- Пишет в нее агент, а он ходит с service_role и RLS обходит.
drop policy if exists "content_jobs_admin_read" on content_jobs;
create policy "content_jobs_admin_read" on content_jobs for select using (
  exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'moderator')
  )
);

-- Админ может поставить задание и отменить его прямо из админки.
drop policy if exists "content_jobs_admin_write" on content_jobs;
create policy "content_jobs_admin_write" on content_jobs for insert with check (
  exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  )
);

drop policy if exists "content_jobs_admin_update" on content_jobs;
create policy "content_jobs_admin_update" on content_jobs for update using (
  exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  )
) with check (true);

-- ---------- Пометка редакционного авторства ----------
--
-- Тексты агента идут от лица «Редакции», и это должно быть видно
-- читателю. В закрытом клубе на 10-15 знакомых выдуманный сосед с
-- собственным мнением вскроется на первой же живой встрече, и доверие
-- просядет заодно ко всем остальным отзывам.
--
-- Флаг на профиле, а не на каждой статье: авторство - свойство того,
-- кто пишет, и одной пометкой закрываются все его тексты сразу.
alter table profiles
  add column if not exists is_editorial boolean not null default false;

comment on column profiles.is_editorial is
  'Редакционный аккаунт: тексты пишет не участник клуба, а редакция.';
