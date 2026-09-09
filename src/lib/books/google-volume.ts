import type { BookAvailability, BookSeries } from './types';

/**
 * Разбор ресурса Volume из Google Books API.
 *
 * Ответ по тому состоит из трех блоков, и раньше мы читали только
 * первый:
 *
 *  - volumeInfo  - об издании: название, авторы, издательство, объем;
 *  - saleInfo    - о продаже: цена, ссылка на покупку;
 *  - accessInfo  - о доступе: предпросмотр, epub, pdf, читалка.
 *
 * Именно из saleInfo и accessInfo на сайте Google собирается вкладка
 * «Получить книгу». Здесь они приводятся к одному компактному виду.
 */

export interface GoogleVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  pageCount?: number;
  printedPageCount?: number;
  printType?: string;
  categories?: string[];
  averageRating?: number;
  ratingsCount?: number;
  maturityRating?: string;
  language?: string;
  imageLinks?: {
    smallThumbnail?: string;
    thumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
    extraLarge?: string;
  };
  industryIdentifiers?: { type: string; identifier: string }[];
  dimensions?: { height?: string; width?: string; thickness?: string };
  seriesInfo?: {
    bookDisplayNumber?: string;
    volumeSeries?: { seriesId?: string; orderNumber?: number }[];
  };
  infoLink?: string;
  previewLink?: string;
  canonicalVolumeLink?: string;
}

export interface GoogleSaleInfo {
  country?: string;
  saleability?: string;
  isEbook?: boolean;
  buyLink?: string;
  listPrice?: { amount?: number; currencyCode?: string };
  retailPrice?: { amount?: number; currencyCode?: string };
}

export interface GoogleAccessInfo {
  country?: string;
  viewability?: string;
  embeddable?: boolean;
  publicDomain?: boolean;
  epub?: { isAvailable?: boolean };
  pdf?: { isAvailable?: boolean };
  webReaderLink?: string;
  accessViewStatus?: string;
}

export interface GoogleVolume {
  id: string;
  volumeInfo?: GoogleVolumeInfo;
  saleInfo?: GoogleSaleInfo;
  accessInfo?: GoogleAccessInfo;
}

/**
 * Насколько книгу дают посмотреть.
 * ALL_PAGES - целиком, PARTIAL - фрагмент, NO_PAGES - никак.
 */
function readPreview(viewability?: string): BookAvailability['preview'] {
  if (viewability === 'ALL_PAGES') return 'full';
  if (viewability === 'PARTIAL') return 'partial';
  return 'none';
}

/** Собирает «что с книгой можно сделать» из двух блоков ответа. */
export function readAvailability(volume: GoogleVolume): BookAvailability | null {
  const sale = volume.saleInfo;
  const access = volume.accessInfo;
  if (!sale && !access) return null;

  // Цена берется розничная: списочная бывает выше и вводит в
  // заблуждение, когда на книгу скидка.
  const price = sale?.retailPrice ?? sale?.listPrice;

  return {
    preview: readPreview(access?.viewability),
    isEbook: Boolean(sale?.isEbook),
    publicDomain: Boolean(access?.publicDomain),
    epub: Boolean(access?.epub?.isAvailable),
    pdf: Boolean(access?.pdf?.isAvailable),
    readerUrl: access?.webReaderLink ?? null,
    buyUrl: sale?.buyLink ?? null,
    price:
      typeof price?.amount === 'number' && price.currencyCode
        ? { amount: price.amount, currency: price.currencyCode }
        : null,
  };
}

/**
 * Серия издания.
 *
 * Google отдает номер книги строкой в bookDisplayNumber, а название
 * серии - нет: в volumeSeries лежит только ее идентификатор. Поэтому
 * название остается пустым, пока не найдется, откуда его взять; номер
 * сам по себе полезен и показывается.
 */
export function readSeries(info?: GoogleVolumeInfo): BookSeries | null {
  const display = info?.seriesInfo?.bookDisplayNumber;
  const order = info?.seriesInfo?.volumeSeries?.[0]?.orderNumber;
  const number = display ? Number(display) : (order ?? null);
  if (number === null || Number.isNaN(number)) return null;
  return { title: null, number };
}

/** Самая крупная из доступных обложек. */
export function largestImageLink(info?: GoogleVolumeInfo): string | null {
  const images = info?.imageLinks ?? {};
  return (
    images.extraLarge ??
    images.large ??
    images.medium ??
    images.small ??
    images.thumbnail ??
    images.smallThumbnail ??
    null
  );
}

/** Физический формат издания - то, что на сайте Google названо «Формат». */
export function readPrintType(info?: GoogleVolumeInfo, isEbook?: boolean): string | null {
  if (isEbook) return 'Электронная книга';
  if (info?.printType === 'BOOK') return 'Книга';
  if (info?.printType === 'MAGAZINE') return 'Журнал';
  return null;
}
