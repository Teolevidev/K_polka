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
 * Поиск выполняется один раз - при переходе, а не при показе витрины:
 * иначе главная опрашивала бы каталоги на каждую из тринадцати обложек.
 *
 * Запасной путь обязателен. ISBN в витрине - конкретного издания, и
 * каталоги знают далеко не каждое: по 9785699130870 («Мастер и
 * Маргарита», Эксмо) Google не находит ничего. Без запасного пути
 * человек упирался в пустую выдачу с номером вместо названия.
 */

interface PageProps {
  params: Promise<{ isbn: string }>;
  searchParams: Promise<{ t?: string; a?: string }>;
}

export default async function BookByIsbnPage({ params, searchParams }: PageProps) {
  const { isbn: raw } = await params;
  const { t: title, a: author } = await searchParams;
  const isbn = cleanIsbn(decodeURIComponent(raw));

  /** Куда отправить человека, если книгу найти не удалось. */
  const giveUp = `/search?q=${encodeURIComponent(title || isbn)}`;

  async function firstMatch(query: string): Promise<string | null> {
    const found = await searchBooks(query).catch(() => null);
    const book = found?.results[0];
    return book ? encodeBookRef(book.source, book.sourceId) : null;
  }

  let ref: string | null = null;

  if (isValidIsbn13(isbn) || isValidIsbn10(isbn)) {
    ref = await firstMatch(isbn);
  }

  // Издания с таким ISBN в каталогах нет - ищем саму книгу по названию
  // и автору. Читателю нужна книга, а не конкретное издание.
  if (!ref && title) {
    ref = await firstMatch([title, author].filter(Boolean).join(' '));
  }

  redirect(ref ? `/book/${ref}` : giveUp);
}
