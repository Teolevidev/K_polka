import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedBook } from './types';
import { cleanIsbn } from './isbn';

/**
 * Поиск по нашему собственному каталогу книг.
 *
 * Третий источник выдачи наравне с Google Books и OpenLibrary, и по
 * русским книгам - самый ценный. Внешние каталоги подводят: у Google
 * плохо покрыта русская художественная литература (по запросу «Василь
 * Быков» он отдает литературоведение о нем, а не его повести), а
 * OpenLibrary нестабилен и romanизует названия.
 *
 * Каталог наполняется двумя путями: книгами, которые участники кладут на
 * полки, и книгами, заведенными вручную. Со временем он становится
 * точнее любого внешнего источника - потому что собран под конкретный
 * круг читателей.
 */

/** Поля каталога, которых хватает для карточки в выдаче. */
const BOOK_SELECT =
  'id, isbn_13, isbn_10, title, subtitle, description, cover_url, page_count, published_date, language, media_type, authors, ratings_count, ratings_sum';

interface CatalogRow {
  id: string;
  isbn_13: string | null;
  isbn_10: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover_url: string | null;
  page_count: number | null;
  published_date: string | null;
  language: string | null;
  media_type: string | null;
  authors: string | null;
  ratings_count?: number | null;
  ratings_sum?: number | null;
}

/** Приводит строку каталога к общему виду выдачи. */
export function catalogRowToBook(row: CatalogRow): NormalizedBook {
  return {
    source: 'local',
    sourceId: row.id,
    isbn13: row.isbn_13,
    isbn10: row.isbn_10,
    title: row.title,
    subtitle: row.subtitle,
    authors: row.authors ? row.authors.split(', ').filter(Boolean) : [],
    description: row.description,
    coverUrl: row.cover_url,
    pageCount: row.page_count,
    publishedDate: row.published_date,
    language: row.language,
    genres: [],
    mediaType: (row.media_type as NormalizedBook['mediaType']) ?? 'book',
    externalRating: null,
  };
}

/**
 * Экранирует строку для фильтра PostgREST.
 *
 * В `or(...)` запятые, скобки и точки разделяют условия, поэтому запрос
 * вроде «Ремарк, Эрих» без очистки развалил бы фильтр. Проценты и
 * подчеркивания - подстановочные знаки ilike, их тоже убираем.
 */
function escapeForFilter(value: string): string {
  return value.replace(/[,().*%_\\"']/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Ищет книги в каталоге.
 *
 * @param supabase клиент Supabase (RLS: таблица books читается всеми)
 * @param query    свободный текст или ISBN
 */
export async function searchLocalCatalog(
  supabase: SupabaseClient,
  query: string,
  options: { isbn?: boolean; limit?: number } = {},
): Promise<NormalizedBook[]> {
  const { isbn = false, limit = 20 } = options;

  if (isbn) {
    const code = cleanIsbn(query);
    const { data, error } = await supabase
      .from('books')
      .select(BOOK_SELECT)
      .or(`isbn_13.eq.${code},isbn_10.eq.${code}`)
      .limit(limit);
    if (error) throw new Error(`Каталог вернул ошибку: ${error.message}`);
    return (data ?? []).map((row) => catalogRowToBook(row as CatalogRow));
  }

  const term = escapeForFilter(query).toLowerCase();
  if (!term) return [];

  // title_normalized - генерируемая колонка (lower + unaccent) с
  // триграммным индексом, поэтому ilike по ней дешев.
  const { data, error } = await supabase
    .from('books')
    .select(BOOK_SELECT)
    .or(`title_normalized.ilike.%${term}%,authors.ilike.%${term}%`)
    .limit(limit);

  if (error) throw new Error(`Каталог вернул ошибку: ${error.message}`);
  return (data ?? []).map((row) => catalogRowToBook(row as CatalogRow));
}

/** Достает одну книгу каталога по её UUID. */
export async function getLocalBookById(
  supabase: SupabaseClient,
  id: string,
): Promise<NormalizedBook | null> {
  const { data } = await supabase
    .from('books')
    .select(BOOK_SELECT)
    .eq('id', id)
    .maybeSingle();

  return data ? catalogRowToBook(data as CatalogRow) : null;
}
