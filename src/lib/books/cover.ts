import type { NormalizedBook } from './types';
import { cleanIsbn } from './isbn';

/**
 * Ссылки на обложки: приведение к рабочему виду и запасной вариант.
 *
 * Обложки приходят из разных источников и разного качества, а у части
 * книг их нет вовсе. Здесь одно место, где решается, какую картинку
 * показать, чтобы карточка и страница книги не расходились.
 */

const OPENLIBRARY_COVERS = 'https://covers.openlibrary.org/b/isbn';

/**
 * Чинит ссылку на обложку.
 *
 * Два известных дефекта:
 *  - Google отдаёт часть ссылок по http, и браузер их блокирует на
 *    странице, открытой по https;
 *  - параметр edge=curl подрисовывает загнутый уголок страницы. Мы
 *    кадрируем обложку по object-cover, уголок при этом обрезается
 *    неаккуратно, а по краю остаётся серая полоса.
 */
export function normalizeCoverUrl(url: string): string {
  const https = url.replace(/^http:/, 'https:');
  try {
    const parsed = new URL(https);
    if (parsed.searchParams.get('edge') === 'curl') {
      parsed.searchParams.delete('edge');
    }
    return parsed.toString();
  } catch {
    return https;
  }
}

/**
 * Обложка по ISBN из OpenLibrary.
 *
 * default=false принципиален: без него OpenLibrary отдаёт серую заглушку
 * с кодом 200, и вместо нашего плейсхолдера с названием книги человек
 * видит чужую пустую картинку. С ним приходит 404, срабатывает onError
 * и рисуется наш вариант.
 */
export function openLibraryCoverByIsbn(isbn: string): string {
  return `${OPENLIBRARY_COVERS}/${cleanIsbn(isbn)}-M.jpg?default=false`;
}

type CoverFields = Pick<NormalizedBook, 'coverUrl' | 'isbn13' | 'isbn10'>;

/**
 * Какую обложку показывать для книги.
 *
 * Своя ссылка - в приоритете. Если её нет, но известен ISBN, пробуем
 * OpenLibrary: у Google Books imageLinks заполнены далеко не у всех
 * томов, особенно у русских изданий, а обложка того же издания в
 * OpenLibrary при этом нередко есть. Ссылка может и не открыться -
 * тогда карточка честно покажет плейсхолдер.
 */
export function resolveCoverUrl(book: CoverFields): string | null {
  if (book.coverUrl) return normalizeCoverUrl(book.coverUrl);
  const isbn = book.isbn13 ?? book.isbn10;
  return isbn ? openLibraryCoverByIsbn(isbn) : null;
}
