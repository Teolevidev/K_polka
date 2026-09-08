import type { NormalizedBook } from './types';
import { searchGoogleBooks } from './google';
import { normalizeText, fuzzyScore } from './normalize';
import { resolveCoverUrl } from './cover';

/**
 * Соседние книги: другие издания того же произведения и другие книги
 * автора.
 *
 * У Google Books нет понятия «произведение» и нет метода «дай мне все
 * издания этого тома» - на сайте эти вкладки собираются поиском. Мы
 * делаем то же самое явными запросами: intitle+inauthor для изданий,
 * inauthor для библиографии автора.
 */

const EDITION_TITLE_THRESHOLD = 0.8;
const AUTHOR_MATCH_THRESHOLD = 0.85;

/** Кавычки внутри значения ломают операторы Google - выкидываем их. */
function quoted(value: string): string {
  return `"${value.replace(/"/g, ' ').trim()}"`;
}

/** Один и тот же том: та же запись, что открыта на странице. */
function isSameVolume(candidate: NormalizedBook, book: NormalizedBook): boolean {
  return candidate.source === book.source && candidate.sourceId === book.sourceId;
}

/**
 * Оставляет по одной книге на произведение и убирает исходную.
 * Ключ - название плюс первый автор: разные тома одного романа
 * схлопываются, разные романы остаются.
 */
function dedupeByWork(
  books: NormalizedBook[],
  exclude: (b: NormalizedBook) => boolean,
  limit: number,
): NormalizedBook[] {
  const seen = new Set<string>();
  const out: NormalizedBook[] = [];
  for (const b of books) {
    if (exclude(b)) continue;
    const key = `${normalizeText(b.title)}|${normalizeText(b.authors[0] ?? '')}`;
    if (!key.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...b, coverUrl: resolveCoverUrl(b) });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Другие издания того же произведения.
 *
 * Название сверяем нечётко: у изданий встречаются подзаголовки и серии
 * («Спектр» / «Спектр: роман»), а вот чужие книги с похожим словом в
 * названии сюда попадать не должны.
 */
export async function getOtherEditions(
  book: NormalizedBook,
  limit = 12,
): Promise<NormalizedBook[]> {
  const author = book.authors[0];
  const query = author
    ? `intitle:${quoted(book.title)} inauthor:${quoted(author)}`
    : `intitle:${quoted(book.title)}`;

  try {
    const found = await searchGoogleBooks(query, { limit: 30 });
    return dedupeByWork(
      found,
      (b) =>
        isSameVolume(b, book) ||
        fuzzyScore(book.title, b.title) < EDITION_TITLE_THRESHOLD,
      limit,
    );
  } catch {
    // Соседние блоки не должны ронять страницу книги.
    return [];
  }
}

/**
 * Другие книги того же автора.
 *
 * Оператор inauthor у Google ищет по полю автора, но всё равно
 * прихватывает книги о нём и сборники составителей - поэтому автора
 * дополнительно сверяем сами.
 */
export async function getBooksByAuthor(
  book: NormalizedBook,
  limit = 12,
): Promise<NormalizedBook[]> {
  const author = book.authors[0];
  if (!author) return [];

  const currentTitle = normalizeText(book.title);

  try {
    const found = await searchGoogleBooks(`inauthor:${quoted(author)}`, {
      limit: 40,
    });
    return dedupeByWork(
      found,
      (b) =>
        isSameVolume(b, book) ||
        normalizeText(b.title) === currentTitle ||
        !b.authors.some((a) => fuzzyScore(author, a) >= AUTHOR_MATCH_THRESHOLD),
      limit,
    );
  } catch {
    return [];
  }
}
