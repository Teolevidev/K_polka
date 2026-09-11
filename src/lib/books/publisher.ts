import type { NormalizedBook } from './types';
import { cleanIsbn } from './isbn';
import { htmlToPlainText } from './normalize';

/**
 * Источник: сайт издательства.
 *
 * Google Books и OpenLibrary хорошо знают классику и англоязычные книги
 * и плохо - современную русскую прозу. Книга, вышедшая в этом году в
 * Редакции Елены Шубиной, у них либо отсутствует, либо лежит без
 * обложки и аннотации. А на сайте издательства она есть всегда: это его
 * собственный товар.
 *
 * ЧТО РАЗБИРАЕМ
 *
 * Не верстку. Читаем структурную разметку - JSON-LD (schema.org/Book и
 * schema.org/Product) и метатеги OpenGraph. Издательские и книготорговые
 * сайты размечают карточки ради сниппетов в поиске, так что разметка
 * там есть почти всегда.
 *
 * Это не компромисс, а осознанный выбор. Парсер по CSS-классам ломается
 * на первом же редизайне и ломается молча: селектор перестает совпадать,
 * функция возвращает пусто, книга просто не заводится. Разметка
 * schema.org живет годами, потому что от нее зависит поисковая выдача
 * издательства, - ее не трогают даже при полной пересборке верстки.
 *
 * И добавление второго издательства становится строчкой в реестре
 * ниже, а не новым модулем.
 *
 * ЧЕГО НЕ ДЕЛАЕМ
 *
 * Не забираем аннотацию издательства на публикацию. Она приезжает в
 * поле description и служит контент-агенту ИСТОЧНИКОМ ФАКТОВ для его
 * собственного текста. Дословно чужой рекламный текст на сайт не идет -
 * см. docs/content-agent.md.
 */

/** Как называется источник в выдаче и в data_sources. */
export const PUBLISHER_SOURCE = 'publisher' satisfies NormalizedBook['source'];

/**
 * Реестр издательств.
 *
 * Хост - ключ. Значение нужно только для подписи в интерфейсе и для
 * белого списка обложек: разбор от издательства не зависит.
 */
export const PUBLISHER_HOSTS: Record<string, { name: string }> = {
  'ast.ru': { name: 'АСТ' },
  'www.ast.ru': { name: 'АСТ' },
  'eksmo.ru': { name: 'Эксмо' },
  'www.eksmo.ru': { name: 'Эксмо' },
  'azbooka.ru': { name: 'Азбука' },
  'www.azbooka.ru': { name: 'Азбука' },
  'alpinabook.ru': { name: 'Альпина' },
  'www.alpinabook.ru': { name: 'Альпина' },
};

/** Знаем ли мы этот сайт. */
export function isKnownPublisherHost(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() in PUBLISHER_HOSTS;
  } catch {
    return false;
  }
}

/** Название издательства по адресу страницы. */
export function publisherNameByUrl(url: string): string | null {
  try {
    return PUBLISHER_HOSTS[new URL(url).hostname.toLowerCase()]?.name ?? null;
  } catch {
    return null;
  }
}

/**
 * Сайт разметил карточку, но разметки не нашлось.
 *
 * Отдельный тип ошибки, потому что чинится это иначе, чем сетевой сбой:
 * сеть - подождать и повторить, а отсутствие разметки - посмотреть
 * глазами и, возможно, написать для этого сайта отдельный разбор.
 */
export class PublisherMarkupError extends Error {
  constructor(url: string) {
    super(`На странице ${url} нет разметки schema.org и og-тегов`);
    this.name = 'PublisherMarkupError';
  }
}

/* ---------- Разбор разметки ---------- */

/** Узел JSON-LD: что угодно, разбираем осторожно. */
type JsonLdNode = Record<string, unknown>;

/**
 * Достает все объекты JSON-LD со страницы.
 *
 * Их бывает несколько: хлебные крошки, организация, сам товар. Поэтому
 * собираем все и ищем нужный тип среди них, а не берем первый попавшийся.
 * Массивы и @graph раскрываем - в обеих формах разметку встречали.
 */
export function extractJsonLd(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1].trim());
    } catch {
      continue; // битый JSON-LD встречается, это не повод падать
    }
    pushNode(parsed, nodes);
  }
  return nodes;
}

function pushNode(value: unknown, out: JsonLdNode[]): void {
  if (Array.isArray(value)) {
    for (const item of value) pushNode(item, out);
    return;
  }
  if (!value || typeof value !== 'object') return;

  const node = value as JsonLdNode;
  out.push(node);
  if ('@graph' in node) pushNode(node['@graph'], out);
}

/** Есть ли у узла нужный тип. @type бывает строкой и массивом. */
function hasType(node: JsonLdNode, ...types: string[]): boolean {
  const raw = node['@type'];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.some(
    (t) => typeof t === 'string' && types.includes(t.toLowerCase()),
  );
}

/** Метатеги: og:title, og:image и им подобные. */
export function extractMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const re = /<meta\s+([^>]+?)\/?>/gi;

  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const attrs = match[1];
    // property= у OpenGraph, name= у обычных метатегов - берем оба.
    const key =
      /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]?.toLowerCase();
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1];
    if (key && content !== undefined && !(key in meta)) {
      meta[key] = decodeEntities(content);
    }
  }
  return meta;
}

/** Минимальный декодер сущностей - в метатегах их немного. */
function decodeEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '-')
    .replace(/&ndash;/g, '-')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Строку, число или объект с name приводим к строке. */
function asText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(asText).filter(Boolean) as string[];
    return parts.length > 0 ? parts.join(', ') : null;
  }
  if (value && typeof value === 'object') {
    const name = (value as JsonLdNode).name;
    return typeof name === 'string' ? name.trim() || null : null;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  const text = asText(value);
  if (!text) return null;
  const n = Number.parseInt(text.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Автор бывает строкой, объектом Person и списком того и другого. */
function readAuthors(value: unknown): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map(asText)
    .filter((a): a is string => Boolean(a))
    .flatMap((a) => a.split(/\s*,\s*/))
    .map((a) => a.trim())
    .filter(Boolean);
}

/** Год издания из даты любой формы: «2024», «2024-05-01», «01.05.2024». */
export function readPublishedYear(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const year = /(1[5-9]\d{2}|20\d{2})/.exec(text)?.[1];
  return year ?? null;
}

/**
 * Собирает карточку книги из HTML страницы издательства.
 *
 * Чистая функция: на вход HTML и адрес, на выход - нормализованная
 * книга. Сеть отдельно, разбор отдельно - так его можно гонять в тестах
 * на сохраненных страницах.
 */
export function parsePublisherPage(html: string, url: string): NormalizedBook {
  const nodes = extractJsonLd(html);
  const meta = extractMeta(html);

  // Книга интереснее товара: у Book есть isbn, автор и число страниц,
  // у Product - цена и картинка. Если есть оба, берем поля из обоих.
  const book = nodes.find((n) => hasType(n, 'book'));
  const product = nodes.find((n) => hasType(n, 'product'));
  const primary = book ?? product ?? null;

  if (!primary && !meta['og:title']) {
    throw new PublisherMarkupError(url);
  }

  const pick = (key: string): unknown =>
    (book?.[key] ?? product?.[key]) as unknown;

  const title =
    asText(pick('name')) ?? meta['og:title'] ?? meta['title'] ?? null;
  if (!title) throw new PublisherMarkupError(url);

  const isbnRaw = asText(pick('isbn'));
  const isbn = isbnRaw ? cleanIsbn(isbnRaw) : null;

  const descriptionRaw =
    asText(pick('description')) ??
    meta['og:description'] ??
    meta['description'] ??
    null;

  const publisher =
    asText(pick('publisher')) ?? publisherNameByUrl(url) ?? null;

  const image = asText(pick('image')) ?? meta['og:image'] ?? null;

  return {
    source: PUBLISHER_SOURCE,
    // Идентификатор - сам адрес страницы: другого стабильного ключа у
    // издательского сайта нет, а этот уникален и ведет обратно к карточке.
    sourceId: url,
    isbn13: isbn && isbn.length === 13 ? isbn : null,
    isbn10: isbn && isbn.length === 10 ? isbn : null,
    title: cleanTitle(title),
    subtitle: null,
    authors: readAuthors(pick('author')),
    description: descriptionRaw ? htmlToPlainText(descriptionRaw) : null,
    coverUrl: image ? absoluteUrl(image, url) : null,
    pageCount: asNumber(pick('numberOfPages')),
    publishedDate: readPublishedYear(
      pick('datePublished') ?? pick('copyrightYear'),
    ),
    publisher,
    sourceUrl: url,
    language: asText(pick('inLanguage')) ?? 'ru',
    genres: [],
    mediaType: 'book',
  };
}

/**
 * Убирает из заголовка хвосты вида «- купить книгу | Издательство АСТ».
 *
 * Нужно для og:title: в JSON-LD name обычно чистый, а в метатег сайты
 * кладут заголовок страницы целиком, вместе с приманкой для поиска.
 */
function cleanTitle(input: string): string {
  return (
    input
      .split(/\s+[|]\s+/)[0]
      // Граница слова через (?![\p{L}]), а не \b: в JavaScript \b
      // опирается на \w, то есть на латиницу, и после кириллического
      // «купить» не срабатывает. С \b это выражение выглядело рабочим и
      // молча не чистило ничего.
      .replace(/\s*[-–—]\s*(купить|читать|скачать|заказать)(?![\p{L}]).*$/iu, '')
      .trim()
  );
}

/** Относительный адрес картинки приводим к абсолютному. */
function absoluteUrl(value: string, base: string): string | null {
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

/* ---------- Сеть ---------- */

const FETCH_TIMEOUT_MS = 12_000;

/**
 * Как мы представляемся.
 *
 * Честный User-Agent с адресом проекта - минимальная вежливость к
 * чужому серверу: администратор должен видеть, кто к нему ходит, и
 * иметь возможность написать нам, а не молча банить непонятный трафик.
 */
const USER_AGENT =
  'KnizhnayaPolka/0.1 (закрытый книжный клуб; +https://github.com/Teolevidev/K_polka)';

/**
 * Скачивает и разбирает карточку книги.
 *
 * Одна страница за вызов и никакого обхода каталога: агент ходит к
 * издательству за конкретной книгой, по конкретной ссылке, а не
 * выкачивает сайт.
 */
export async function fetchPublisherBook(
  url: string,
  options: { signal?: AbortSignal } = {},
): Promise<NormalizedBook> {
  if (!isKnownPublisherHost(url)) {
    throw new Error(`Сайт ${safeHost(url)} не в списке известных издательств`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const signal = options.signal ?? controller.signal;

  try {
    const res = await fetch(url, {
      signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'ru,en;q=0.8',
      },
      // Карточка книги меняется редко - сутки кеша экономят и наш
      // трафик, и чужой сервер.
      next: { revalidate: 86_400 },
    });

    if (!res.ok) {
      throw new Error(`${safeHost(url)} ответил ${res.status}`);
    }

    return parsePublisherPage(await res.text(), url);
  } finally {
    clearTimeout(timer);
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 60);
  }
}
