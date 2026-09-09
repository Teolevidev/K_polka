import type { NormalizedBook } from './types';
import { cleanIsbn } from './isbn';

/**
 * Ссылки на обложки.
 *
 * Все, что лежит на чужих серверах, отдается читателю через наш
 * маршрут /api/cover - см. подробности там. Здесь только собирается
 * адрес: что именно попросить и в каком размере.
 */

/** Хосты, картинки с которых умеет отдавать /api/cover. */
const PROXIED_HOSTS = new Set([
  'books.google.com',
  'books.googleusercontent.com',
  'covers.openlibrary.org',
]);

/** Размер обложки: карточка в выдаче, полка, страница книги. */
export type CoverSize = 's' | 'm' | 'l';

type CoverFields = Pick<
  NormalizedBook,
  'coverUrl' | 'isbn13' | 'isbn10' | 'source' | 'sourceId'
>;

/** true, если картинку с этого адреса имеет смысл гнать через себя. */
export function isProxiedHost(url: string): boolean {
  try {
    return PROXIED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Какую обложку показывать для книги.
 *
 * Порядок такой: готовая ссылка от источника, потом идентификатор тома
 * в Google, потом ISBN. Все три складываются в один запрос: маршрут
 * переберет их сам и вернет первую настоящую картинку. Поэтому здесь
 * нет ветвления «а если не загрузится» - это забота сервера, а не
 * браузера.
 */
export function resolveCoverUrl(
  book: CoverFields,
  size: CoverSize = 'm',
): string | null {
  const params = new URLSearchParams();

  if (book.coverUrl) {
    // Своя обложка (ручное добавление, Supabase Storage) уходит как
    // есть: гнать ее через прокси незачем, а белый список ее и не
    // пропустит.
    if (!isProxiedHost(book.coverUrl)) return book.coverUrl;
    params.set('u', book.coverUrl);
  }

  if (book.source === 'google' && book.sourceId) {
    params.set('g', book.sourceId);
  }

  const isbn = book.isbn13 ?? book.isbn10;
  if (isbn) params.set('isbn', cleanIsbn(isbn));

  // Просить нечего - покажем плейсхолдер с названием.
  if (!params.has('u') && !params.has('g') && !params.has('isbn')) return null;

  params.set('size', size);
  return `/api/cover?${params.toString()}`;
}

/**
 * Готовая ссылка на обложку - в вид, пригодный для показа.
 *
 * Нужна для картинок, которые пришли не из поиска, а из базы: витрина
 * главной, полки, редакционные подборки. Там в cover_url лежит прямой
 * адрес чужого сервера, сохраненный когда-то при добавлении книги.
 *
 * Свои адреса (начинаются со слэша) и посторонние хосты остаются как
 * есть: первые уже наши, вторые белый список все равно не пропустит.
 */
export function proxiedCoverUrl(
  url: string | null | undefined,
  size: CoverSize = 'm',
): string | null {
  if (!url) return null;
  if (url.startsWith('/')) return url;
  if (!isProxiedHost(url)) return url;
  return `/api/cover?u=${encodeURIComponent(url)}&size=${size}`;
}
