/**
 * Справка об авторе.
 *
 * Важно понимать, откуда что берётся: у Google Books API биографий нет
 * вовсе. Блок «Автор», который виден на сайте Google Книг, собирается
 * из их графа знаний и через API недоступен. Поэтому справку берём из
 * Википедии - открытый источник с хорошим покрытием русских авторов.
 */

export interface AuthorInfo {
  name: string;
  /** Краткая справка в несколько предложений. */
  summary: string;
  photoUrl: string | null;
  /** Ссылка на статью, чтобы читатель мог проверить и прочитать целиком. */
  articleUrl: string | null;
  /** Язык статьи: показываем, если справка не на русском. */
  lang: 'ru' | 'en';
}

const LANGS = ['ru', 'en'] as const;
const REQUEST_TIMEOUT_MS = 6_000;

interface WikiSummary {
  type?: string;
  title?: string;
  extract?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'KnizhnayaPolka/0.1 (book tracker)' },
      signal: controller.signal,
      next: { revalidate: 604_800 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Точное название статьи.
 *
 * Прямое обращение по имени работает не всегда: в русской Википедии
 * статьи о людях называются «Лукьяненко, Сергей Васильевич», а
 * перенаправление с «Сергей Лукьяненко» есть не у каждого автора.
 */
async function findArticleTitle(lang: string, name: string): Promise<string | null> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(name)}&srlimit=1&format=json&origin=*`;
  const data = await fetchJson<{ query?: { search?: { title?: string }[] } }>(url);
  return data?.query?.search?.[0]?.title ?? null;
}

async function fetchSummary(lang: string, title: string): Promise<WikiSummary | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title,
  )}`;
  return fetchJson<WikiSummary>(url);
}

/**
 * Ищет справку об авторе - сначала в русской Википедии, потом в английской.
 *
 * Возвращает null, если ничего не нашлось или нашлась страница
 * неоднозначности: лучше не показать блок совсем, чем показать справку
 * не о том человеке.
 */
export async function getAuthorInfo(name: string): Promise<AuthorInfo | null> {
  const trimmed = name.trim();
  if (trimmed.length < 3) return null;

  for (const lang of LANGS) {
    let summary = await fetchSummary(lang, trimmed);

    if (!summary?.extract || summary.type === 'disambiguation') {
      const title = await findArticleTitle(lang, trimmed);
      summary = title ? await fetchSummary(lang, title) : null;
    }

    if (!summary?.extract || summary.type === 'disambiguation') continue;

    return {
      name: summary.title ?? trimmed,
      summary: summary.extract,
      photoUrl: summary.thumbnail?.source ?? null,
      articleUrl: summary.content_urls?.desktop?.page ?? null,
      lang,
    };
  }

  return null;
}
