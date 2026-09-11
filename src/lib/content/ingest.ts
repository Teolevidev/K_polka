import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { searchGoogleBooks } from '@/lib/books/google';
import { searchOpenLibrary } from '@/lib/books/openlibrary';
import { scoreBook, compareResults } from '@/lib/books/search';
import { findOrCreateBook } from '@/lib/books/catalog';
import { cleanIsbn, looksLikeIsbn } from '@/lib/books/isbn';
import { fetchPublisherBook, isKnownPublisherHost } from '@/lib/books/publisher';
import { mergeBooks } from '@/lib/books/search';
import { preferredLanguage } from '@/lib/books/normalize';
import type { NormalizedBook } from '@/lib/books/types';
import type { ContentJobResult, IngestBookPayload } from './types';

/**
 * Заведение книги в каталог.
 *
 * Каталог до сих пор наполнялся только руками участников: книга
 * появлялась в таблице `books`, когда кто-то клал ее на полку. Из-за
 * этого свой источник поиска - самый ценный по русским книгам - почти
 * всегда пустовал, а «Выбор администратора» держал название и автора
 * отдельной копией, потому что ссылаться было не на что.
 *
 * Здесь тот же путь, что у пользователя, только без пользователя:
 * поиск по внешним источникам, выбор лучшего совпадения, upsert.
 * Дедупликация уже есть в findOrCreateBook - по ISBN и идентификатору
 * тома, так что повторный прогон того же списка ничего не испортит.
 */

/** Ниже этого балла совпадение считается не тем, что искали. */
const MIN_SCORE = 0.45;

export interface IngestOutcome extends ContentJobResult {
  bookId: string;
  title: string;
  authors: string[];
  /** Книга уже была в каталоге - ничего не создавали. */
  existed: boolean;
}

/** Строит поисковый запрос из задания. */
export function buildIngestQuery(payload: IngestBookPayload): {
  query: string;
  isbn: boolean;
} {
  // Ссылка на издательство обрабатывается отдельным путем и сюда не
  // доходит; если дошла - значит, задание собрали неправильно.
  const isbn = payload.isbn?.trim();
  if (isbn) {
    // Кривой ISBN не пускаем в текстовый поиск. «12345» найдет в Google
    // что угодно, и в каталог приедет случайная книга - а человек будет
    // уверен, что завел ту, чей номер переписал с обложки.
    if (!looksLikeIsbn(isbn)) {
      throw new Error(`«${isbn}» не похож на ISBN: нужно 10 или 13 цифр`);
    }
    return { query: cleanIsbn(isbn), isbn: true };
  }

  const parts = [payload.title, payload.author].filter(Boolean).map((s) => s!.trim());
  if (parts.length > 0) return { query: parts.join(' '), isbn: false };

  const free = payload.query?.trim();
  if (free) return { query: free, isbn: false };

  throw new Error('В задании нет ни ISBN, ни названия, ни запроса');
}

/**
 * Ищет книгу во внешних источниках и возвращает лучшее совпадение.
 *
 * Оба источника опрашиваются разом и падение любого из них не отменяет
 * задание: у Google плохо с русской художественной литературой, у
 * OpenLibrary - со стабильностью, и порознь они закрывают дыры друг
 * друга. Ранжирование берем то же, что у живого поиска, - иначе агент
 * заводил бы в каталог не то, что человек увидел бы на сайте.
 */
export async function findBestMatch(
  payload: IngestBookPayload,
): Promise<NormalizedBook | null> {
  // Дали ссылку на карточку издательства - идем туда и не гадаем.
  if (payload.url) return fetchFromPublisher(payload.url);

  const { query, isbn } = buildIngestQuery(payload);

  const [google, openlibrary] = await Promise.all([
    searchGoogleBooks(query, { isbn, limit: 20 }).catch(() => [] as NormalizedBook[]),
    searchOpenLibrary(query, { isbn, limit: 20 }).catch(() => [] as NormalizedBook[]),
  ]);

  const all = [...google, ...openlibrary];
  if (all.length === 0) return null;

  // По ISBN ранжировать нечего: источник уже ответил на точный вопрос.
  // Берем запись с обложкой и наибольшим числом заполненных полей.
  if (isbn) {
    return (
      all.slice().sort((a, b) => completeness(b) - completeness(a))[0] ?? null
    );
  }

  const preferredLang = preferredLanguage(query);
  const scored = all.map((book) => ({
    ...book,
    score: scoreBook(book, query, preferredLang),
    sources: [book.source],
  }));

  scored.sort(compareResults(preferredLang, query));
  const best = scored[0];
  if (!best || best.score < MIN_SCORE) return null;

  // Если в задании указан автор, а у найденной книги он другой - это
  // почти всегда книга ОБ авторе, а не его собственная.
  const wantedAuthor = payload.author?.trim().toLowerCase();
  if (wantedAuthor) {
    const surname = wantedAuthor.split(/\s+/).pop() ?? '';
    const matches =
      surname.length > 2 &&
      best.authors.some((a) => a.toLowerCase().includes(surname));
    if (!matches) return null;
  }

  return best;
}

/**
 * Книга со страницы издательства, дополненная внешними каталогами.
 *
 * Издательство знает свою книгу лучше всех: название, автора, ISBN, год,
 * объем и аннотацию. Чего оно не знает - так это идентификаторов Google
 * и OpenLibrary, а они нужны нам ради обложек разных размеров и ради
 * склейки с изданиями, которые участники уже клали на полки.
 *
 * Поэтому по ISBN с карточки делаем один точный запрос наружу и
 * подмешиваем то, чего у издательства нет. Данные издательства при этом
 * главнее: mergeBooks вызывается так, что его поля идут первым
 * аргументом и перетираются только там, где у него пусто.
 */
async function fetchFromPublisher(url: string): Promise<NormalizedBook | null> {
  if (!isKnownPublisherHost(url)) {
    throw new Error(`Сайт этой ссылки не в списке известных издательств: ${url}`);
  }

  const book = await fetchPublisherBook(url);
  const isbn = book.isbn13 ?? book.isbn10;
  if (!isbn) return book;

  const [google, openlibrary] = await Promise.all([
    searchGoogleBooks(isbn, { isbn: true, limit: 3 }).catch(
      () => [] as NormalizedBook[],
    ),
    searchOpenLibrary(isbn, { isbn: true, limit: 3 }).catch(
      () => [] as NormalizedBook[],
    ),
  ]);

  let enriched = book;
  for (const external of [...google, ...openlibrary]) {
    enriched = mergeBooks(enriched, external, 'ru');
  }

  // Идентификаторы внешних каталогов переносим руками.
  //
  // mergeBooks их не сводит: у него source и sourceId берутся из первого
  // аргумента целиком, а отдельных полей под чужие идентификаторы в
  // NormalizedBook два - googleVolumeId и workId, и заполняет их не
  // каждый источник. Без этих двух строк книга с сайта издательства
  // приезжала бы в каталог без связи с Google, то есть без запасных
  // размеров обложки и без склейки с изданиями, которые участники уже
  // клали на полки.
  const googleVolumeId = google.find((b) => b.source === 'google')?.sourceId;
  const workId = openlibrary.find((b) => b.workId)?.workId;

  return {
    ...enriched,
    // Источником остается издательство: адрес карточки - наш ключ к ней.
    source: book.source,
    sourceId: book.sourceId,
    sourceUrl: url,
    googleVolumeId: googleVolumeId ?? enriched.googleVolumeId ?? null,
    workId: workId ?? enriched.workId ?? null,
  };
}

/** Сколько полей карточки заполнено - грубая мера полноты записи. */
function completeness(book: NormalizedBook): number {
  const fields = [
    book.isbn13,
    book.description,
    book.coverUrl,
    book.pageCount,
    book.publishedDate,
    book.publisher,
    book.language,
  ];
  return fields.filter(Boolean).length;
}

/**
 * Выполняет задание «завести книгу».
 *
 * Ничего не придумывает: в каталог попадает только то, что ответили
 * источники. Аннотация, если ее нет, остается пустой - лучше пустое
 * поле, чем сочиненный пересказ, который потом кто-то прочтет как факт.
 */
export async function runIngestBook(
  payload: IngestBookPayload,
  client?: SupabaseClient,
): Promise<IngestOutcome> {
  const supabase = client ?? createSupabaseAdminClient();

  const match = await findBestMatch(payload);
  if (!match) {
    const { query } = buildIngestQuery(payload);
    throw new Error(`Книга не найдена во внешних источниках: «${query}»`);
  }

  // Была ли книга в каталоге до нас - нужно только для отчета.
  const before = await lookupExisting(supabase, match);
  const bookId = await findOrCreateBook(supabase, match);

  const warnings: string[] = [];
  if (!match.coverUrl) warnings.push('нет обложки');
  if (!match.description) warnings.push('нет аннотации');
  if (!match.isbn13) warnings.push('нет ISBN-13');

  const from =
    match.source === 'publisher' && match.publisher
      ? ` (${match.publisher})`
      : '';

  return {
    summary: before
      ? `Книга уже была в каталоге: «${match.title}»`
      : `Завел книгу «${match.title}»${from}`,
    bookId,
    title: match.title,
    authors: match.authors,
    existed: Boolean(before),
    warnings,
  };
}

/** Есть ли уже такая книга в каталоге. */
async function lookupExisting(
  supabase: SupabaseClient,
  book: NormalizedBook,
): Promise<string | null> {
  const filters: string[] = [];
  if (book.isbn13) filters.push(`isbn_13.eq.${book.isbn13}`);
  if (book.source === 'google') filters.push(`google_books_id.eq.${book.sourceId}`);
  if (book.source === 'openlibrary') {
    filters.push(`openlibrary_work_id.eq.${book.sourceId}`);
  }
  if (filters.length === 0) return null;

  const { data } = await supabase
    .from('books')
    .select('id')
    .or(filters.join(','))
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
