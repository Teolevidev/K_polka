import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedBook } from './types';

/**
 * Каталог книг в нашей БД.
 *
 * Книги попадают в таблицу `books`, когда пользователь добавляет их на
 * полку. findOrCreateBook ищет книгу по внешним идентификаторам и
 * возвращает её UUID, при необходимости создавая запись.
 */

/** Нормализует строку даты издания в формат date (YYYY-MM-DD) или null. */
function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return null;
  const year = m[1];
  const month = m[2] ?? '01';
  const day = m[3] ?? '01';
  return `${year}-${month}-${day}`;
}

/** Колонка-идентификатор внешнего источника. */
function sourceColumn(source: NormalizedBook['source']): string | null {
  if (source === 'google') return 'google_books_id';
  if (source === 'openlibrary') return 'openlibrary_work_id';
  return null;
}

/**
 * Находит книгу в каталоге или создаёт её. Возвращает UUID книги.
 * @param supabase клиент с правами авторизованного пользователя
 */
export async function findOrCreateBook(
  supabase: SupabaseClient,
  book: NormalizedBook,
): Promise<string> {
  // 1. Поиск по внешним идентификаторам
  const orFilters: string[] = [];
  if (book.isbn13) orFilters.push(`isbn_13.eq.${book.isbn13}`);
  const col = sourceColumn(book.source);
  if (col) orFilters.push(`${col}.eq.${book.sourceId}`);

  if (orFilters.length > 0) {
    const { data: found } = await supabase
      .from('books')
      .select('id')
      .or(orFilters.join(','))
      .limit(1)
      .maybeSingle();
    if (found?.id) return found.id as string;
  }

  // 2. Создание новой записи
  const { data: created, error } = await supabase
    .from('books')
    .insert({
      isbn_13: book.isbn13,
      isbn_10: book.isbn10,
      google_books_id: book.source === 'google' ? book.sourceId : null,
      openlibrary_work_id: book.source === 'openlibrary' ? book.sourceId : null,
      title: book.title,
      subtitle: book.subtitle,
      description: book.description,
      cover_url: book.coverUrl,
      page_count: book.pageCount,
      published_date: toIsoDate(book.publishedDate),
      language: book.language,
      media_type: book.mediaType,
      authors: book.authors.join(', '),
      data_sources: [book.source],
      fetched_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !created) {
    throw new Error(`Не удалось сохранить книгу в каталог: ${error?.message ?? ''}`);
  }
  return created.id as string;
}
