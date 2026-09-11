import { redirect } from 'next/navigation';
import { searchBooks } from '@/lib/books/search';
import { encodeBookRef } from '@/lib/books/ref';
import { cleanIsbn, isValidIsbn10, isValidIsbn13 } from '@/lib/books/isbn';

/**
 * Переход к книге по ISBN.
 *
 * Витрина главной знает про книгу только название, автора и ISBN -
 * идентификатора тома у нее нет и взяться ему неоткуда. Раньше карточка
 * вела в поиск по названию, и человек, ткнув в «Мастер и Маргарита»,
 * попадал на список из двадцати изданий вместо книги.
 *
 * Этот маршрут находит книгу по ISBN и уводит на ее страницу. Поиск
 * выполняется один раз - при переходе, а не при показе витрины: иначе
 * главная опрашивала бы каталоги на каждую из тринадцати обложек.
 */

interface PageProps {
  params: Promise<{ isbn: string }>;
}

export default async function BookByIsbnPage({ params }: PageProps) {
  const { isbn: raw } = await params;
  const isbn = cleanIsbn(decodeURIComponent(raw));

  if (!isValidIsbn13(isbn) && !isValidIsbn10(isbn)) {
    redirect(`/search?q=${encodeURIComponent(isbn)}`);
  }

  const found = await searchBooks(isbn).catch(() => null);
  const book = found?.results[0];

  // Не нашлось - отправляем в поиск: там человек хотя бы увидит, что
  // искали, и сможет поправить запрос или завести книгу вручную.
  if (!book) {
    redirect(`/search?q=${encodeURIComponent(isbn)}`);
  }

  redirect(`/book/${encodeBookRef(book.source, book.sourceId)}`);
}
