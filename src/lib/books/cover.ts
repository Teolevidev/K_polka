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
  // Сайты издательств: обложку берем оттуда же, откуда карточку.
  // Файл к себе не перекладываем - только отдаем через свой домен,
  // как и всем остальным источникам.
  'ast.ru',
  'www.ast.ru',
  'eksmo.ru',
  'www.eksmo.ru',
  'azbooka.ru',
  'www.azbooka.ru',
  'alpinabook.ru',
  'www.alpinabook.ru',
]);

/** Размер обложки: карточка в выдаче, полка, страница книги. */
export type CoverSize = 's' | 'm' | 'l';

type CoverFields = Pick<
  NormalizedBook,
  | 'coverUrl'
  | 'isbn13'
  | 'isbn10'
  | 'source'
  | 'sourceId'
  | 'googleVolumeId'
  | 'title'
  | 'authors'
>;

/** Длина, после которой название в запросе только мешает. */
const MAX_QUERY_LEN = 120;

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

  // Том Google: либо книга пришла оттуда прямо сейчас, либо ее
  // идентификатор сохранен в каталоге при добавлении.
  //
  // Важная тонкость: если API сказал, что обложки у тома нет
  // (imageLinks пуст, а значит пуст и coverUrl), просить ее у Google
  // бессмысленно - он ответит 200 и отдаст свою заглушку «image not
  // available», и она встанет в карточку как настоящая обложка.
  // Лучше сразу идти к ISBN и соседним изданиям.
  const fromGoogleNow = book.source === 'google' ? book.sourceId : null;
  const volumeId = fromGoogleNow
    ? book.coverUrl
      ? fromGoogleNow
      : null
    : book.googleVolumeId;
  if (volumeId) params.set('g', volumeId);

  const isbn = book.isbn13 ?? book.isbn10;
  if (isbn) params.set('isbn', cleanIsbn(isbn));

  // Название и автор - последняя зацепка: по ним маршрут найдет обложку
  // у другого издания того же произведения. У редких книг это
  // единственное, что вообще есть.
  if (book.title) params.set('t', book.title.slice(0, MAX_QUERY_LEN));
  const author = book.authors?.[0];
  if (author) params.set('a', author.slice(0, MAX_QUERY_LEN));

  // Просить нечего - покажем плейсхолдер с названием.
  if (!params.has('u') && !params.has('g') && !params.has('isbn') && !params.has('t')) {
    return null;
  }

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
  title?: string | null,
  author?: string | null,
): string | null {
  // Даже без готовой ссылки обложку можно найти по названию и автору -
  // у соседнего издания того же произведения.
  if (!url) {
    if (!title) return null;
    const params = new URLSearchParams({ t: title.slice(0, MAX_QUERY_LEN), size });
    if (author) params.set('a', author.slice(0, MAX_QUERY_LEN));
    return `/api/cover?${params.toString()}`;
  }

  if (url.startsWith('/')) return url;
  if (!isProxiedHost(url)) return url;

  const params = new URLSearchParams({ u: url, size });
  if (title) params.set('t', title.slice(0, MAX_QUERY_LEN));
  if (author) params.set('a', author.slice(0, MAX_QUERY_LEN));
  return `/api/cover?${params.toString()}`;
}
