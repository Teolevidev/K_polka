import { NextRequest, NextResponse } from 'next/server';

/**
 * ВРЕМЕННЫЙ диагностический маршрут: что книжные API отвечают серверу.
 *
 * Нужен, потому что ни одна доступная нам машина до Google Books не
 * достаёт: сеть разработчика режет TLS к googleapis.com, а окружение
 * ассистента упирается в чужую исчерпанную квоту. Сервер Vercel при
 * этом ходит наружу свободно, поэтому спрашиваем у него.
 *
 * Открыть: /api/debug/search-probe?q=Пушкин
 *
 * Секретов не отдаёт: про ключ Google сообщает только сам факт наличия.
 * УДАЛИТЬ, как только вопрос с источниками будет закрыт.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SourceReport {
  ok: boolean;
  status: number | null;
  error?: string;
  totalFound?: number;
  returned?: number;
  languages?: Record<string, number>;
  sample?: string[];
}

/** Считает, сколько результатов пришло на каждом языке. */
function countLanguages(langs: (string | undefined)[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const lang of langs) {
    const key = lang || 'без языка';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

async function probeGoogle(query: string, lang: string | null): Promise<SourceReport> {
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', '20');
  url.searchParams.set('printType', 'books');
  if (lang) url.searchParams.set('langRestrict', lang);
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    url.searchParams.set('key', process.env.GOOGLE_BOOKS_API_KEY);
  }

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        ok: false,
        status: res.status,
        // Тело ответа Google не содержит нашего ключа — он уходит в строке
        // запроса, а не возвращается обратно.
        error: body.slice(0, 300),
      };
    }

    const data = (await res.json()) as {
      totalItems?: number;
      items?: { volumeInfo?: { title?: string; language?: string; authors?: string[] } }[];
    };
    const items = data.items ?? [];

    return {
      ok: true,
      status: res.status,
      totalFound: data.totalItems ?? 0,
      returned: items.length,
      languages: countLanguages(items.map((i) => i.volumeInfo?.language)),
      sample: items.slice(0, 8).map((i) => {
        const v = i.volumeInfo ?? {};
        return `[${v.language ?? '??'}] ${v.title ?? 'без названия'} — ${(v.authors ?? []).join(', ') || 'без автора'}`;
      }),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeOpenLibrary(query: string): Promise<SourceReport> {
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '20');
  url.searchParams.set('fields', 'key,title,author_name,language,edition_count');

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'KnizhnayaPolka/0.1 (book tracker)' },
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, status: res.status };

    const data = (await res.json()) as {
      numFound?: number;
      docs?: { title?: string; author_name?: string[]; language?: string[] }[];
    };
    const docs = data.docs ?? [];

    return {
      ok: true,
      status: res.status,
      totalFound: data.numFound ?? 0,
      returned: docs.length,
      languages: countLanguages(docs.map((d) => d.language?.[0])),
      sample: docs.slice(0, 8).map(
        (d) =>
          `[${d.language?.[0] ?? '??'}] ${d.title} — ${(d.author_name ?? []).join(', ') || 'без автора'}`,
      ),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.trim() || 'Пушкин';

  const [googleNoLang, googleRu, googleInAuthor, openlibrary] = await Promise.all([
    probeGoogle(query, null),
    probeGoogle(query, 'ru'),
    // Google понимает операторы по полям. Проверяем догадку: не даст ли
    // inauthor: книги САМОГО автора вместо книг о нём.
    probeGoogle(`inauthor:"${query}"`, null),
    probeOpenLibrary(query),
  ]);

  return NextResponse.json(
    {
      запрос: query,
      ключGoogleЗадан: Boolean(process.env.GOOGLE_BOOKS_API_KEY),
      google_безФильтраЯзыка: googleNoLang,
      google_langRestrict_ru: googleRu,
      google_inauthor: googleInAuthor,
      openlibrary,
      какЧитать: [
        'Если google_безФильтраЯзыка.ok = false со статусом 429 — исчерпана квота, нужен ключ.',
        'Если ok = true и в languages много ru — Google отвечает, и русские издания есть.',
        'Если openlibrary отдаёт названия латиницей — это транслитерация ALA-LC, ожидаемо.',
        'Сравните returned у обоих источников: кто реально наполняет выдачу.',
        'google_inauthor — главная проверка: если там книги САМОГО автора, а не о нём, значит нужен оператор inauthor.',
      ],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
