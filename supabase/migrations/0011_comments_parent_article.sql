-- Миграция 0011 — добавляем 'article' в допустимые parent_type комментариев.
alter table comments drop constraint if exists comments_parent_type_check;
alter table comments add constraint comments_parent_type_check
  check (parent_type in ('review', 'post', 'article', 'comment'));
