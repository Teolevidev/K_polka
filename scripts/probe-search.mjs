#!/usr/bin/env node
/**
 * Диагностика поиска книг: что реально отвечают внешние API.
 *
 * Нужен, когда выдача выглядит странно, а понять причину по коду нельзя:
 * скрипт бьет напрямую в Google Books и OpenLibrary и печатает, сколько
 * пришло, на каких языках и что именно.
 *
 * Запуск:
 *   node scripts/probe-search.mjs "Лавр Водолазкин"
 *   node --env-file=.env.local scripts/probe-search.mjs "Лавр"   // с ключом Google
 *
 * Ключ GOOGLE_BOOKS_API_KEY необязателен, но без него Google считает
 * лимиты по IP и легко отвечает 429 - это само по себе частая причина
 * пустой выдачи.
 */

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Укажи запрос: node scripts/probe-search.mjs "Лавр Водолазкин"');
  process.exit(1);
}

const GOOGLE = 'https://www.googleapis.com/books/v1/volumes';
const OPENLIBRARY = 'https://openlibrary.org/search.json';

function head(text) {
  console.log('\n' + '='.repeat(64) + '\n' + text + '\n' + '='.repeat(64));
}

/** Считает, сколько книг пришло на каждом языке. */
function byLanguage(langs) {
  const counts = new Map();
  for (const lang of langs) {
    const key = lang || 'без языка';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang, n]) => `${lang}: ${n}`)
    .join(', ');
}

async function google(langRestrict) {
  const url = new URL(GOOGLE);
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', '20');
  url.searchParams.set('printType', 'books');
  if (langRestrict) url.searchParams.set('langRestrict', langRestrict);
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    url.searchParams.set('key', process.env.GOOGLE_BOOKS_API_KEY);
  }

  const label = langRestrict ? `Google Books, langRestrict=${langRestrict}` : 'Google Books, без фильтра языка';
  head(label);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.log(`ОШИБКА ${res.status}. ${body.slice(0, 300)}`);
    if (res.status === 429) {
      console.log('\n429 - это исчерпанная квота. Без ключа Google считает ее по IP.');
    }
    return;
  }

  const data = await res.json();
  const items = data.items ?? [];
  console.log(`Всего: ${data.totalItems ?? 0}, отдано: ${items.length}`);
  if (!items.length) {
    console.log('ПУСТО - вот и причина, если выдача пустая.');
    return;
  }
  console.log('Языки:', byLanguage(items.map((i) => i.volumeInfo?.language)));
  console.log();
  for (const item of items.slice(0, 8)) {
    const v = item.volumeInfo ?? {};
    const rating = v.averageRating ? ` оценка ${v.averageRating} (${v.ratingsCount ?? 0})` : '';
    console.log(`  [${v.language ?? '??'}] ${v.title ?? 'без названия'} - ${(v.authors ?? []).join(', ') || 'без автора'}${rating}`);
  }
}

async function openlibrary() {
  head('OpenLibrary');

  const url = new URL(OPENLIBRARY);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '20');
  url.searchParams.set(
    'fields',
    'key,title,author_name,language,edition_count,ratings_average,ratings_count',
  );

  const res = await fetch(url, {
    headers: { 'User-Agent': 'KnizhnayaPolka/0.1 (book tracker)' },
  });
  if (!res.ok) {
    console.log(`ОШИБКА ${res.status}`);
    return;
  }

  const data = await res.json();
  const docs = data.docs ?? [];
  console.log(`Найдено: ${data.numFound ?? 0}, отдано: ${docs.length}`);
  if (!docs.length) {
    console.log('ПУСТО - OpenLibrary слабо индексирует кириллицу, это ожидаемо.');
    return;
  }
  console.log('Языки:', byLanguage(docs.map((d) => d.language?.[0])));
  console.log();
  for (const doc of docs.slice(0, 8)) {
    const rating = doc.ratings_average
      ? ` оценка ${doc.ratings_average.toFixed(1)} (${doc.ratings_count ?? 0})`
      : '';
    console.log(
      `  [${doc.language?.[0] ?? '??'}] ${doc.title} - ${(doc.author_name ?? []).join(', ') || 'без автора'}` +
        ` изданий: ${doc.edition_count ?? 1}${rating}`,
    );
  }
}

console.log(`Запрос: "${query}"`);
console.log(`Ключ Google: ${process.env.GOOGLE_BOOKS_API_KEY ? 'есть' : 'НЕТ (лимиты по IP)'}`);

await google(null);
await google('ru');
await openlibrary();

head('Что смотреть');
console.log(`
- Если «без фильтра языка» находит, а «langRestrict=ru» пусто -
  подтверждается, что жесткий фильтр по языку и был причиной.
- Если оба варианта Google пусты, а ошибки нет - книги просто нет
  в индексе под таким запросом.
- Если 429 - нужен GOOGLE_BOOKS_API_KEY в переменных окружения Vercel.
- Если OpenLibrary пуст на кириллице - это его известная слабость,
  и тогда всю русскую выдачу тянет один Google.
`);
