import type { BookSource } from './types';

/**
 * Ссылки на книги.
 *
 * Пока книги не сохранены в нашей БД, страница книги адресуется
 * по «ссылке источника»: source + sourceId, упакованные в URL-безопасную
 * строку. Когда книга попадает в локальный каталог, ссылкой станет наш UUID.
 */

export interface BookRef {
  source: BookSource;
  sourceId: string;
}

/** Кодирует ссылку на книгу в URL-безопасную строку (base64url). */
export function encodeBookRef(source: BookSource, sourceId: string): string {
  const payload = `${source}::${sourceId}`;
  return Buffer.from(payload, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Декодирует строку обратно в ссылку на книгу. Возвращает null при ошибке. */
export function decodeBookRef(ref: string): BookRef | null {
  try {
    const base64 = ref.replace(/-/g, '+').replace(/_/g, '/');
    const payload = Buffer.from(base64, 'base64').toString('utf8');
    const sep = payload.indexOf('::');
    if (sep === -1) return null;
    const source = payload.slice(0, sep) as BookSource;
    const sourceId = payload.slice(sep + 2);
    if (!sourceId) return null;
    return { source, sourceId };
  } catch {
    return null;
  }
}
