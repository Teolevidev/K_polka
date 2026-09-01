import type {
  NormalizedBook,
  SearchResultBook,
  BookSource,
  BookSearchResponse,
} from './types';
import { detectQueryKind } from './isbn';
import {
  normalizeText,
  fuzzyScore,
  preferredLanguage,
  detectScript,
} from './normalize';
import { searchGoogleBooks } from './google';
import { searchOpenLibrary } from './openlibrary';

/**
 * Федеративный поиск книг.
 *
 * Стратегия:
 *  1. Параллельно опрашиваем источники с тайм-аутом.
 *  2. Группируем по произведению (название + первый автор), а не по изданию —
 *     разные ISBN одной книги схлопываются в одну карточку.
 *  3. Скорим: точное совпадение названия → большой бонус, «мусор»
 *     (sparknotes, summary, notes, study guide…) → штраф.
 *  4. Сортируем: score → книги искомого автора → алфавит названия →
 *     число изданий → число источников.
 */

const SOURCE_TIMEOUT_MS = 12_000;

const NOISE_PATTERN =
  /\b(spark ?notes|cliffs ?notes|study guide|study notes|summary of|guide to|adaptation|notes on)\b/i;

/**
 * Индекс «ISBN издания → произведение», построенный по ответам OpenLibrary.
 *
 * Нужен, потому что Google Books отдаёт отдельные издания и не знает про
 * произведения: «Лавр» и «Laurus» приходят двумя разными записями. OpenLibrary
 * же группирует переводы в одно произведение и перечисляет ISBN его изданий —
 * по ним издания Google и привязываются к произведению.
 */
export function buildWorkIndex(books: NormalizedBook[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const book of books) {
    if (!book.workId) continue;
    for (const isbn of book.editionIsbns ?? []) {
      if (!index.has(isbn)) index.set(isbn, book.workId);
    }
  }
  return index;
}

/**
 * Ключ группировки книги по произведению.
 *
 * Порядок: собственный work → work, найденный по ISBN издания →
 * название с автором → ISBN → название.
 */
export function dedupeKey(
  book: NormalizedBook,
  workIndex?: Map<string, string>,
): string {
  if (book.workId) return `work:${book.workId}`;

  const viaIsbn = book.isbn13 ? workIndex?.get(book.isbn13) : undefined;
  if (viaIsbn) return `work:${viaIsbn}`;

  const title = normalizeText(book.title);
  const author = normalizeText(book.authors[0] ?? '');
  if (title && author) return `ta:${title}|${author}`;
  if (book.isbn13) return `isbn:${book.isbn13}`;
  return `t:${title || book.sourceId}`;
}

/**
 * Сливает две версии одной книги, выбирая более полные поля.
 *
 * Когда язык запроса известен, «лицо» карточки (название, подзаголовок,
 * обложка, язык) берётся у издания на этом языке: склеив «Лавр» с «Laurus»,
 * показать нужно «Лавр».
 */
export function mergeBooks(
  a: NormalizedBook,
  b: NormalizedBook,
  preferredLang: string | null = null,
): NormalizedBook {
  const longer = (x: string | null, y: string | null) =>
    (x?.length ?? 0) >= (y?.length ?? 0) ? x : y;

  // Издание, чьё название и обложка пойдут на карточку.
  const aMatches = Boolean(preferredLang) && a.language === preferredLang;
  const bMatches = Boolean(preferredLang) && b.language === preferredLang;
  const face = aMatches === bMatches ? a : aMatches ? a : b;
  const other = face === a ? b : a;

  return {
    ...a,
    title: face.title,
    subtitle: face.subtitle ?? other.subtitle,
    coverUrl: face.coverUrl ?? other.coverUrl,
    language: face.language ?? other.language,
    isbn13: a.isbn13 ?? b.isbn13,
    isbn10: a.isbn10 ?? b.isbn10,
    description: longer(a.description, b.description),
    pageCount: a.pageCount ?? b.pageCount,
    publishedDate: a.publishedDate ?? b.publishedDate,
    authors: a.authors.length >= b.authors.length ? a.authors : b.authors,
    genres: Array.from(new Set([...a.genres, ...b.genres])),
    editionCount: Math.max(a.editionCount ?? 1, b.editionCount ?? 1),
    workId: a.workId ?? b.workId,
    editionIsbns:
      (a.editionIsbns?.length ?? 0) >= (b.editionIsbns?.length ?? 0)
        ? a.editionIsbns
        : b.editionIsbns,
    // Из двух внешних оценок берём ту, что опирается на больше голосов.
    externalRating:
      (a.externalRating?.count ?? 0) >= (b.externalRating?.count ?? 0)
        ? (a.externalRating ?? b.externalRating ?? null)
        : (b.externalRating ?? null),
  };
}

async function runSource(
  name: BookSource,
  fn: (signal: AbortSignal) => Promise<NormalizedBook[]>,
): Promise<{ source: BookSource; books: NormalizedBook[]; ok: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    const books = await fn(controller.signal);
    return { source: name, books, ok: true };
  } catch {
    return { source: name, books: [], ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Бонус за совпадение языка издания с языком запроса.
 *
 * Именно бонус, без парного штрафа иноязычным изданиям: результаты
 * отсекаются по порогу score >= 0.25, и штраф утаскивал пограничные книги
 * под порог. Тогда редкая книга, найденная только в переводе, пропадала
 * из выдачи совсем. Бонус же может изменить порядок, но ничего не теряет.
 */
const LANG_BONUS = 0.15;

/**
 * Бонус названию, набранному тем же алфавитом, что и запрос.
 *
 * OpenLibrary отдаёт русские книги из библиотечных каталогов в
 * транслитерации ALA-LC: «Пиковая дама» приходит как «Pikovaia dama».
 * Язык у такой записи стоит русский, поэтому языковой бонус её не
 * отличает — различает только алфавит названия.
 */
const TITLE_SCRIPT_BONUS = 0.1;

/** Порог, с которого считаем, что запрос — это имя автора книги. */
const AUTHOR_MATCH_THRESHOLD = 0.9;

/**
 * Книга написана тем, кого ищут.
 *
 * Отличает книги Пушкина от книг о Пушкине: по запросу «Пушкин» биография,
 * названная его фамилией, получает идеальное совпадение по названию и
 * обгоняет собрание сочинений. Обычно человек ищет книги автора, а не
 * книги про него, поэтому такие результаты идут выше.
 */
export function isByQueriedAuthor(book: NormalizedBook, query: string): boolean {
  return book.authors.some((a) => fuzzyScore(query, a) >= AUTHOR_MATCH_THRESHOLD);
}

/** Название набрано тем же алфавитом, что и запрос. */
export function titleMatchesQueryScript(book: NormalizedBook, query: string): boolean {
  const queryScript = detectScript(query);
  if (queryScript === 'other') return false;
  return detectScript(book.title) === queryScript;
}

/**
 * Скор книги. Учитывает:
 *  - совпадение названия (fuzzy),
 *  - точное совпадение названия → большой бонус,
 *  - совпадение автора,
 *  - штраф за «мусор» в названии,
 *  - совпадение языка издания с языком запроса.
 *
 * @param preferredLang код языка, ожидаемого в выдаче, либо null
 */
export function scoreBook(
  book: NormalizedBook,
  query: string,
  preferredLang: string | null = null,
): number {
  const nq = normalizeText(query);
  const nt = normalizeText(book.title);

  const titleText = [book.title, book.subtitle].filter(Boolean).join(' ');
  const titleScore = fuzzyScore(query, titleText);
  const authorScore = book.authors.length
    ? Math.max(...book.authors.map((a) => fuzzyScore(query, a)))
    : 0;

  // Совпадение по автору раньше было ослаблено множителем 0.85, из-за
  // чего книга, названная фамилией автора, обгоняла его собственные книги.
  // Сигналы равноправны, а что важнее при равном балле — решает компаратор.
  let score = Math.max(titleScore, authorScore);

  if (nt === nq && nq.length >= 2) {
    // точное совпадение названия — почти гарантированный топ
    score = Math.min(1, score + 0.35);
  } else if (nt.startsWith(nq) && nq.length >= 3) {
    score = Math.min(1, score + 0.12);
  }

  if (NOISE_PATTERN.test(book.title)) {
    score = Math.max(0, score - 0.3);
  }

  // Язык. Без этого русское и английское издание одной книги получают
  // одинаковый балл, и наверх всплывает то, у которого больше изданий, —
  // почти всегда англоязычное.
  if (preferredLang && book.language === preferredLang) {
    score = Math.min(1, score + LANG_BONUS);
  }

  // Алфавит названия. Запрос «Пушкин» совпадает с автором, а не с
  // названием, поэтому у всех его книг балл почти одинаковый и решают
  // тайбрейкеры. Без этого романизованные записи OpenLibrary вытесняют
  // наверх русские: у них больше изданий.
  if (titleMatchesQueryScript(book, query)) {
    score = Math.min(1, score + TITLE_SCRIPT_BONUS);
  }

  return Number(score.toFixed(4));
}

/**
 * Компаратор результатов выдачи.
 *
 * Порядок сравнения: релевантность → совпадение языка → книги искомого
 * автора → алфавит названия → число изданий → число подтвердивших
 * источников → наличие обложки.
 *
 * Тайбрейкеры несут основную работу: при поиске по фамилии у всех книг
 * автора балл почти одинаковый, и порядок целиком определяется здесь.
 * Число изданий намеренно стоит последним из содержательных признаков —
 * оно велико у оригиналов и у записей библиотечных каталогов, и раньше
 * из-за него наверх попадали переводы и транслитерации.
 */
export function compareResults(preferredLang: string | null = null, query = '') {
  return (a: SearchResultBook, b: SearchResultBook): number => {
    if (b.score !== a.score) return b.score - a.score;

    if (preferredLang) {
      const langDelta =
        (b.language === preferredLang ? 1 : 0) -
        (a.language === preferredLang ? 1 : 0);
      if (langDelta !== 0) return langDelta;
    }

    // Книги искомого автора важнее книг о нём: по запросу «Пушкин»
    // сначала Пушкин, потом биографии Пушкина.
    if (query) {
      const authorDelta =
        (isByQueriedAuthor(b, query) ? 1 : 0) - (isByQueriedAuthor(a, query) ? 1 : 0);
      if (authorDelta !== 0) return authorDelta;
    }

    // Алфавит названия важнее числа изданий: у романизованных записей
    // изданий заметно больше, и иначе они выигрывают у русских.
    if (query) {
      const scriptDelta =
        (titleMatchesQueryScript(b, query) ? 1 : 0) -
        (titleMatchesQueryScript(a, query) ? 1 : 0);
      if (scriptDelta !== 0) return scriptDelta;
    }

    const editionDelta = (b.editionCount ?? 1) - (a.editionCount ?? 1);
    if (editionDelta !== 0) return editionDelta;

    if (b.sources.length !== a.sources.length) {
      return b.sources.length - a.sources.length;
    }
    return (b.coverUrl ? 1 : 0) - (a.coverUrl ? 1 : 0);
  };
}

export interface SearchOptions {
  /**
   * Показать результаты на всех алфавитах. По умолчанию русский запрос
   * отдаёт только русские названия — это выбор человека, а не источника.
   */
  allScripts?: boolean;
}

export async function searchBooks(
  rawQuery: string,
  options: SearchOptions = {},
): Promise<BookSearchResponse> {
  const query = rawQuery.trim();
  if (query.length < 2) {
    return {
      query,
      results: [],
      respondedSources: [],
      failedSources: [],
      filteredByScript: false,
      hiddenByScript: 0,
    };
  }

  const kind = detectQueryKind(query);
  const isbn = kind === 'isbn';
  const preferredLang = isbn ? null : preferredLanguage(query);

  // Языком источники не ограничиваем: жёсткий фильтр выбрасывает книги,
  // у которых язык в метаданных не проставлен, а таких среди русских
  // изданий много. Предпочтение языку делается ниже, ранжированием.
  const sourceResults = await Promise.all([
    runSource('google', (signal) =>
      searchGoogleBooks(query, { isbn, signal, limit: 30 }),
    ),
    runSource('openlibrary', (signal) =>
      searchOpenLibrary(query, { isbn, signal, limit: 30 }),
    ),
  ]);

  const respondedSources: BookSource[] = [];
  const failedSources: BookSource[] = [];
  for (const r of sourceResults) {
    (r.ok ? respondedSources : failedSources).push(r.source);
  }

  // Группировка по произведению. Индекс строим по всем ответам сразу,
  // чтобы издания Google подтянулись к произведениям OpenLibrary.
  const allBooks = sourceResults.flatMap((r) => r.books);
  const workIndex = buildWorkIndex(allBooks);

  const merged = new Map<string, { book: NormalizedBook; sources: Set<BookSource> }>();
  for (const book of allBooks) {
    const key = dedupeKey(book, workIndex);
    const existing = merged.get(key);
    if (existing) {
      existing.book = mergeBooks(existing.book, book, preferredLang);
      existing.sources.add(book.source);
    } else {
      merged.set(key, { book, sources: new Set([book.source]) });
    }
  }

  const scored: SearchResultBook[] = Array.from(merged.values())
    .map(({ book, sources }) => ({
      ...book,
      score: isbn ? 1 : scoreBook(book, query, preferredLang),
      sources: Array.from(sources),
    }))
    .filter((b) => isbn || b.score >= 0.25);

  scored.sort(compareResults(preferredLang, isbn ? '' : query));

  // Фильтр по алфавиту: по русскому запросу показываем русские названия,
  // без транслитераций вроде «Pikovaia dama» и переводов.
  //
  // С обязательной страховкой: если после фильтра не осталось ничего,
  // показываем всё. Пустая выдача хуже неидеальной — на langRestrict мы
  // этот урок уже получили.
  const wantsScriptFilter = !options.allScripts && !isbn && preferredLang !== null;
  const onScript = wantsScriptFilter
    ? scored.filter((b) => titleMatchesQueryScript(b, query))
    : scored;
  const filteredByScript = wantsScriptFilter && onScript.length > 0;
  const visible = filteredByScript ? onScript : scored;

  return {
    query,
    results: visible.slice(0, 50),
    respondedSources,
    failedSources,
    filteredByScript,
    hiddenByScript: filteredByScript ? scored.length - onScript.length : 0,
  };
}
