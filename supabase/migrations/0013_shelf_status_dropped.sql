-- Новый статус полки: «не буду читать».
--
-- Книгу, которую человек бросил или решил не читать, некуда было деть:
-- она либо висела в «Хочу прочесть» как невыполненное обещание, либо
-- уходила с полки совсем - вместе с оценкой и отзывом.
--
-- В статистику прочитанного не попадает: totalRating и цель года
-- считаются только по status = 'read'.

alter table user_books drop constraint if exists user_books_status_check;

alter table user_books
  add constraint user_books_status_check
  check (status in ('reading', 'read', 'want', 'dropped'));
