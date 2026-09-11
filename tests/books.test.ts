import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  levenshtein,
  similarity,
  fuzzyScore,
  detectScript,
  preferredLanguage,
  stripLigatureMarks,
  htmlToPlainText,
  fuzzyMatch,
  matchesQuery,
} from '@/lib/books/normalize';
import {
  resolveCoverUrl,
  isProxiedHost,
  proxiedCoverUrl,
} from '@/lib/books/cover';
import {
  formatPublishedDate,
  buildEditionFacts,
} from '@/components/book/book-details';
import {
  scoreBook,
  compareResults,
  titleMatchesQueryScript,
  isByQueriedAuthor,
  dedupeKey,
  mergeBooks,
  buildWorkIndex,
} from '@/lib/books/search';
import type { NormalizedBook, SearchResultBook } from '@/lib/books/types';
import {
  isValidIsbn10,
  isValidIsbn13,
  isbn10to13,
  looksLikeIsbn,
  detectQueryKind,
} from '@/lib/books/isbn';
import { encodeBookRef, decodeBookRef } from '@/lib/books/ref';
import { localizeGenre, localizeGenres } from '@/lib/books/genres';
import { readImageSize, looksLikeCover } from '@/lib/books/image-size';
import { isTransientStatus, SourceUnavailableError } from '@/lib/books/detail';

describe('normalizeText', () => {
  it('приводит регистр и ё→е', () => {
    expect(normalizeText('Тёплый Хлеб')).toBe('теплый хлеб');
  });

  it('убирает пунктуацию и лишние пробелы', () => {
    expect(normalizeText('  Война  и,  мир!  ')).toBe('война и мир');
  });

  it('снимает латинскую диакритику', () => {
    expect(normalizeText('Café')).toBe('cafe');
  });
});

describe('levenshtein', () => {
  it('равные строки → 0', () => {
    expect(levenshtein('толстой', 'толстой')).toBe(0);
  });

  it('одна опечатка → 1', () => {
    expect(levenshtein('толстой', 'толстай')).toBe(1);
  });
});

describe('similarity', () => {
  it('идентичные строки → 1', () => {
    expect(similarity('булгаков', 'булгаков')).toBe(1);
  });

  it('похожие строки → высокий балл', () => {
    expect(similarity('булгаков', 'булгокав')).toBeGreaterThan(0.6);
  });
});

describe('fuzzyScore — терпимость к опечаткам', () => {
  it('точное совпадение названия → высокий балл', () => {
    expect(fuzzyScore('мастер и маргарита', 'Мастер и Маргарита')).toBeGreaterThan(
      0.9,
    );
  });

  it('опечатка в фамилии автора → всё ещё находит', () => {
    // «Достоевскй» вместо «Достоевский»
    expect(fuzzyScore('достоевскй', 'Фёдор Достоевский')).toBeGreaterThan(0.7);
  });

  it('опечатка в названии → всё ещё находит', () => {
    // «преступленье и наказанье»
    expect(
      fuzzyScore('преступленье и наказанье', 'Преступление и наказание'),
    ).toBeGreaterThan(0.7);
  });

  it('нерелевантный запрос → низкий балл', () => {
    expect(fuzzyScore('кулинария', 'Властелин колец')).toBeLessThan(0.3);
  });

  it('случайное совпадение букв не считается совпадением', () => {
    // Живой случай: по запросу «Лукьяненко спектр» в выдачу лезли
    // «Дефектоскопия» и «Воспроизводство сиговых рыб» - слово «спектр»
    // там в научном смысле, а посимвольное сходство давало им ~0.4,
    // и пара таких слов перешагивала порог отсечения.
    expect(fuzzyScore('спектр', 'Дефектоскопия')).toBeLessThan(0.25);
    expect(fuzzyScore('лукьяненко спектр', 'Книжная летопись')).toBeLessThan(0.25);
    expect(fuzzyScore('лукьяненко спектр', 'Воспроизводство сиговых рыб')).toBeLessThan(0.25);
  });

  it('настоящее совпадение по-прежнему набирает много', () => {
    expect(fuzzyScore('лукьяненко спектр', 'Спектр')).toBeGreaterThan(0.4);
    expect(fuzzyScore('спектр', 'Спектр')).toBeGreaterThan(0.9);
  });
});

describe('ISBN', () => {
  it('валидирует корректный ISBN-13', () => {
    expect(isValidIsbn13('9780306406157')).toBe(true);
  });

  it('отклоняет некорректный ISBN-13', () => {
    expect(isValidIsbn13('9780306406158')).toBe(false);
  });

  it('валидирует ISBN-10 с контрольным X', () => {
    expect(isValidIsbn10('080442957X')).toBe(true);
  });

  it('конвертирует ISBN-10 в ISBN-13', () => {
    const converted = isbn10to13('0306406152');
    expect(converted).toBe('9780306406157');
  });

  it('распознаёт строку-ISBN', () => {
    expect(looksLikeIsbn('978-0-306-40615-7')).toBe(true);
    expect(looksLikeIsbn('Война и мир')).toBe(false);
  });

  it('определяет вид запроса', () => {
    expect(detectQueryKind('9780306406157')).toBe('isbn');
    expect(detectQueryKind('Толстой')).toBe('free-text');
  });
});

describe('detectScript / preferredLanguage', () => {
  it('кириллический запрос → русский язык выдачи', () => {
    expect(detectScript('Лавр Водолазкин')).toBe('cyrillic');
    expect(preferredLanguage('Лавр Водолазкин')).toBe('ru');
  });

  it('латинский запрос → язык не навязываем', () => {
    expect(detectScript('Laurus Vodolazkin')).toBe('latin');
    expect(preferredLanguage('Laurus Vodolazkin')).toBeNull();
  });

  it('строка без букв → other', () => {
    expect(detectScript('12345 ---')).toBe('other');
    expect(preferredLanguage('12345 ---')).toBeNull();
  });
});

/** Заготовка книги: переопределяем только то, что важно для теста. */
function book(patch: Partial<NormalizedBook>): NormalizedBook {
  return {
    source: 'google',
    sourceId: 'x',
    isbn13: null,
    isbn10: null,
    title: '',
    subtitle: null,
    authors: [],
    description: null,
    coverUrl: null,
    pageCount: null,
    publishedDate: null,
    language: null,
    genres: [],
    mediaType: 'book',
    ...patch,
  };
}

function result(patch: Partial<SearchResultBook>): SearchResultBook {
  return { ...book({}), score: 0.5, sources: ['google'], ...patch };
}

describe('scoreBook — язык выдачи', () => {
  const ru = book({ title: 'Лавр', authors: ['Евгений Водолазкин'], language: 'ru' });
  const en = book({ title: 'Лавр', authors: ['Евгений Водолазкин'], language: 'en' });

  it('русское издание получает больше английского на русский запрос', () => {
    const query = 'Лавр Водолазкин';
    expect(scoreBook(ru, query, 'ru')).toBeGreaterThan(scoreBook(en, query, 'ru'));
  });

  it('без языка запроса издания неразличимы', () => {
    const query = 'Лавр Водолазкин';
    expect(scoreBook(ru, query, null)).toBe(scoreBook(en, query, null));
  });

  it('книга без указанного языка не штрафуется', () => {
    const query = 'Лавр';
    const unknown = book({ title: 'Лавр', language: null });
    expect(scoreBook(unknown, query, 'ru')).toBe(scoreBook(unknown, query, null));
  });

  it('иноязычное издание не теряет баллов, а только не получает бонус', () => {
    // Штраф утаскивал пограничные книги под порог отсечения 0.25, и книга,
    // существующая только в переводе, пропадала из выдачи совсем.
    const query = 'Лавр Водолазкин';
    expect(scoreBook(en, query, 'ru')).toBe(scoreBook(en, query, null));
  });
});

describe('compareResults — порядок выдачи', () => {
  it('русское издание обгоняет английское, даже если у того больше изданий', () => {
    // Ровно та жалоба: у оригинала изданий всегда больше, и раньше
    // он выигрывал тайбрейкер у русского перевода.
    const russian = result({ title: 'Лавр', language: 'ru', editionCount: 2, score: 0.9 });
    const english = result({ title: 'Laurus', language: 'en', editionCount: 40, score: 0.9 });

    const sorted = [english, russian].sort(compareResults('ru'));
    expect(sorted[0].title).toBe('Лавр');
  });

  it('без языка запроса тайбрейкер остаётся по числу изданий', () => {
    const few = result({ title: 'A', language: 'en', editionCount: 2, score: 0.9 });
    const many = result({ title: 'B', language: 'en', editionCount: 40, score: 0.9 });

    const sorted = [few, many].sort(compareResults(null));
    expect(sorted[0].title).toBe('B');
  });

  it('релевантность всё равно важнее языка', () => {
    const relevant = result({ title: 'Лавр', language: 'en', score: 0.95 });
    const weak = result({ title: 'Что-то другое', language: 'ru', score: 0.4 });

    const sorted = [weak, relevant].sort(compareResults('ru'));
    expect(sorted[0].title).toBe('Лавр');
  });
});

describe('схлопывание переводов через work OpenLibrary', () => {
  // OpenLibrary отдаёт произведение и ISBN его изданий — в том числе
  // переводов. Google Books отдаёт отдельные издания без work.
  const olWork = book({
    source: 'openlibrary',
    sourceId: '/works/OL123W',
    workId: '/works/OL123W',
    title: 'Лавр',
    authors: ['Евгений Водолазкин'],
    language: 'ru',
    editionIsbns: ['9785171234567', '9781234567897'],
    editionCount: 12,
  });

  const googleRu = book({
    source: 'google',
    sourceId: 'g-ru',
    title: 'Лавр',
    authors: ['Евгений Водолазкин'],
    language: 'ru',
    isbn13: '9785171234567',
  });

  const googleEn = book({
    source: 'google',
    sourceId: 'g-en',
    title: 'Laurus',
    authors: ['Eugene Vodolazkin'],
    language: 'en',
    isbn13: '9781234567897',
  });

  it('индекс связывает ISBN изданий с произведением', () => {
    const index = buildWorkIndex([olWork, googleRu, googleEn]);
    expect(index.get('9785171234567')).toBe('/works/OL123W');
    expect(index.get('9781234567897')).toBe('/works/OL123W');
  });

  it('русское и английское издания попадают в одну группу', () => {
    const index = buildWorkIndex([olWork, googleRu, googleEn]);
    expect(dedupeKey(googleRu, index)).toBe(dedupeKey(googleEn, index));
    expect(dedupeKey(olWork, index)).toBe(dedupeKey(googleEn, index));
  });

  it('без индекса перевод остаётся отдельной карточкой', () => {
    // Так вело себя до правки: разные названия → разные ключи.
    expect(dedupeKey(googleRu)).not.toBe(dedupeKey(googleEn));
  });

  it('издание с неизвестным ISBN не приклеивается к чужому произведению', () => {
    const index = buildWorkIndex([olWork]);
    const foreign = book({
      title: 'Совсем другая книга',
      authors: ['Кто-то'],
      isbn13: '9789999999999',
    });
    expect(dedupeKey(foreign, index)).not.toBe(dedupeKey(olWork, index));
  });

  it('при склейке карточка показывает русское название, а не перевод', () => {
    const merged = mergeBooks(googleEn, googleRu, 'ru');
    expect(merged.title).toBe('Лавр');
    expect(merged.language).toBe('ru');
  });

  it('без языка запроса название берётся у первого издания', () => {
    const merged = mergeBooks(googleEn, googleRu, null);
    expect(merged.title).toBe('Laurus');
  });

  it('склейка сохраняет наибольшее число изданий и work', () => {
    const merged = mergeBooks(googleRu, olWork, 'ru');
    expect(merged.editionCount).toBe(12);
    expect(merged.workId).toBe('/works/OL123W');
  });
});

describe('транслитерация ALA-LC из OpenLibrary', () => {
  // Библиотечные каталоги записывают «ю» как «i͡u» — с половинками
  // лигатуры U+FE20/FE21, которые шрифты не рисуют.
  const raw = 'Ruslan i Li︠u︡dmila';

  it('половинки лигатур убираются из названия', () => {
    expect(stripLigatureMarks(raw)).toBe('Ruslan i Liudmila');
  });

  it('normalizeText тоже их снимает, чтобы поиск совпадал', () => {
    expect(normalizeText(raw)).toBe('ruslan i liudmila');
  });

  it('чистая строка не меняется', () => {
    expect(stripLigatureMarks('Пиковая дама')).toBe('Пиковая дама');
  });
});

describe('алфавит названия против транслитерации', () => {
  // Ровно случай со скриншота: запрос «Пушкин» совпадает с автором,
  // поэтому баллы почти равны и всё решают тайбрейкеры.
  const cyrillic = { title: 'Пиковая дама', authors: ['Александр Сергеевич Пушкин'] };
  const romanized = { title: 'Pikovaia dama', authors: ['Александр Сергеевич Пушкин'] };

  it('кириллическое название получает больше транслитерированного', () => {
    // Без автора, чтобы балл не упирался в потолок: у книг самого Пушкина
    // совпадение по автору идеальное, и разницу видно только в компараторе.
    expect(scoreBook(book({ title: 'Пиковая дама' }), 'Пиковая', 'ru')).toBeGreaterThan(
      scoreBook(book({ title: 'Pikovaia dama' }), 'Пиковая', 'ru'),
    );
  });

  it('кириллическое название обгоняет транслитерацию с бо́льшим числом изданий', () => {
    // Записи OpenLibrary несут большой editionCount, у Google его нет
    // вовсе — из-за этого транслитерация и вытесняла русские названия.
    const ru = result({ ...cyrillic, language: 'ru', editionCount: 1, score: 0.9 });
    const alaLc = result({ ...romanized, language: 'ru', editionCount: 60, score: 0.9 });

    const sorted = [alaLc, ru].sort(compareResults('ru', 'Пушкин'));
    expect(sorted[0].title).toBe('Пиковая дама');
  });

  it('на латинский запрос алфавит названия не мешает', () => {
    const en = result({ title: 'The Queen of Spades', language: 'en', editionCount: 60, score: 0.9 });
    const ru = result({ title: 'Пиковая дама', language: 'ru', editionCount: 1, score: 0.9 });

    const sorted = [ru, en].sort(compareResults(null, 'Pushkin'));
    expect(sorted[0].title).toBe('The Queen of Spades');
  });
});

describe('книги автора против книг о нём', () => {
  // Случай со скриншота: по запросу «Пушкин» первыми шли биографии,
  // потому что их название совпадает с запросом идеально, а совпадение
  // по автору было ослаблено множителем.
  const pushkin = 'Александр Сергеевич Пушкин';

  it('книга автора распознаётся по фамилии в запросе', () => {
    expect(isByQueriedAuthor(book({ authors: [pushkin] }), 'Пушкин')).toBe(true);
    expect(isByQueriedAuthor(book({ authors: ['Л. М. Аринштейн'] }), 'Пушкин')).toBe(false);
  });

  it('книга без автора не считается написанной искомым автором', () => {
    expect(isByQueriedAuthor(book({ authors: [] }), 'Пушкин')).toBe(false);
  });

  it('совпадение по автору больше не ослаблено относительно названия', () => {
    // Раньше множитель 0.85 гарантированно ставил книгу автора ниже.
    const byAuthor = book({ title: 'Сказки', authors: [pushkin] });
    const aboutHim = book({ title: 'Пушкин', authors: ['Л. М. Аринштейн'] });

    expect(scoreBook(byAuthor, 'Пушкин')).toBeGreaterThanOrEqual(
      scoreBook(aboutHim, 'Пушкин') - 0.001,
    );
  });

  it('в выдаче книга автора идёт выше биографии о нём', () => {
    const skazki = result({ title: 'Сказки', authors: [pushkin], language: 'ru', score: 1 });
    const biography = result({
      title: 'Пушкин',
      authors: ['Л. М. Аринштейн'],
      language: 'ru',
      score: 1,
    });

    const sorted = [biography, skazki].sort(compareResults('ru', 'Пушкин'));
    expect(sorted[0].title).toBe('Сказки');
  });

  it('транслитерированная книга автора всё равно выше биографии', () => {
    // Автор важнее алфавита названия: «Fairy tales» Пушкина нужнее,
    // чем книга о Пушкине, пусть и с русским названием.
    const fairyTales = result({ title: 'Fairy tales', authors: [pushkin], score: 1 });
    const biography = result({ title: 'Пушкин', authors: ['Л. М. Аринштейн'], score: 1 });

    const sorted = [biography, fairyTales].sort(compareResults('ru', 'Пушкин'));
    expect(sorted[0].title).toBe('Fairy tales');
  });

  it('при поиске по названию правило про автора не мешает', () => {
    const exact = result({ title: 'Пиковая дама', authors: [pushkin], score: 0.95 });
    const other = result({ title: 'Сказки', authors: [pushkin], score: 0.5 });

    const sorted = [other, exact].sort(compareResults('ru', 'Пиковая дама'));
    expect(sorted[0].title).toBe('Пиковая дама');
  });
});

describe('внешние оценки', () => {
  it('при склейке побеждает оценка с бо́льшим числом голосов', () => {
    const few = book({ title: 'Лавр', externalRating: { average: 4.9, count: 3 } });
    const many = book({ title: 'Лавр', externalRating: { average: 4.1, count: 900 } });

    expect(mergeBooks(few, many).externalRating).toEqual({ average: 4.1, count: 900 });
    expect(mergeBooks(many, few).externalRating).toEqual({ average: 4.1, count: 900 });
  });

  it('оценка подхватывается, даже если у первого издания её нет', () => {
    const none = book({ title: 'Лавр', externalRating: null });
    const rated = book({ title: 'Лавр', externalRating: { average: 4.1, count: 900 } });

    expect(mergeBooks(none, rated).externalRating).toEqual({ average: 4.1, count: 900 });
  });

  it('когда оценок нет нигде, остаётся null', () => {
    const a = book({ title: 'Лавр', externalRating: null });
    const b = book({ title: 'Лавр' });

    expect(mergeBooks(a, b).externalRating).toBeNull();
  });
});

describe('фильтр выдачи по алфавиту', () => {
  // Проверяем саму логику отбора: русский запрос показывает русские
  // названия, но никогда не оставляет человека с пустым экраном.
  function filter(books: SearchResultBook[], query: string) {
    const onScript = books.filter((b) => titleMatchesQueryScript(b, query));
    const filtered = onScript.length > 0;
    return {
      results: filtered ? onScript : books,
      filteredByScript: filtered,
      hiddenByScript: filtered ? books.length - onScript.length : 0,
    };
  }

  const cyrillic = result({ title: 'Пиковая дама' });
  const romanized = result({ title: 'Pikovaia dama' });
  const translated = result({ title: 'The Queen of Spades' });

  it('русский запрос оставляет только русские названия', () => {
    const out = filter([cyrillic, romanized, translated], 'Пушкин');
    expect(out.results.map((b) => b.title)).toEqual(['Пиковая дама']);
    expect(out.filteredByScript).toBe(true);
    expect(out.hiddenByScript).toBe(2);
  });

  it('книги искомого автора остаются, даже если название латиницей', () => {
    // Живые данные показали: работы Пушкина приходят из OpenLibrary с
    // романизованными названиями, а книги О Пушкине - из Google с
    // русскими. Фильтр по алфавиту без этой поблажки оставлял бы
    // «Шесть статей о Пушкине» и выбрасывал «Evgeni Onegin».
    const byPushkin = result({
      title: 'Evgeni Onegin',
      authors: ['Александр Сергеевич Пушкин'],
    });
    const aboutPushkin = result({
      title: 'Шесть статей о Пушкине',
      authors: ['Александр Ильич Незеленов'],
    });

    const kept = [byPushkin, aboutPushkin].filter(
      (b) => titleMatchesQueryScript(b, 'Пушкин') || isByQueriedAuthor(b, 'Пушкин'),
    );
    expect(kept.map((b) => b.title)).toContain('Evgeni Onegin');
    expect(kept).toHaveLength(2);
  });

  it('если русских названий нет вовсе, показываем всё', () => {
    // Страховка от повторения истории с langRestrict: пустая выдача
    // хуже неидеальной.
    const out = filter([romanized, translated], 'Пушкин');
    expect(out.results).toHaveLength(2);
    expect(out.filteredByScript).toBe(false);
    expect(out.hiddenByScript).toBe(0);
  });
});

describe('отказ источника против отсутствия книги', () => {
  it('404 и 410 означают, что книги действительно нет', () => {
    expect(isTransientStatus(404)).toBe(false);
    expect(isTransientStatus(410)).toBe(false);
  });

  it('исчерпанная квота и сбои — это отказ источника, а не отсутствие книги', () => {
    // Ровно этот случай выдавал «Страница не найдена» на живую книгу.
    expect(isTransientStatus(429)).toBe(true);
    expect(isTransientStatus(500)).toBe(true);
    expect(isTransientStatus(503)).toBe(true);
    expect(isTransientStatus(403)).toBe(true);
  });

  it('ошибка несёт имя источника и код ответа', () => {
    const error = new SourceUnavailableError('Google Books', 429);
    expect(error.source).toBe('Google Books');
    expect(error.status).toBe(429);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('book ref — кодирование ссылок', () => {
  it('кодирование и декодирование возвращает исходное значение', () => {
    const ref = encodeBookRef('openlibrary', '/works/OL45883W');
    const decoded = decodeBookRef(ref);
    expect(decoded).toEqual({
      source: 'openlibrary',
      sourceId: '/works/OL45883W',
    });
  });

  it('ref является URL-безопасным', () => {
    const ref = encodeBookRef('google', 'zyTCAlFPjgYC');
    expect(ref).not.toMatch(/[+/=]/);
  });

  it('невалидная ссылка → null', () => {
    expect(decodeBookRef('!!!не-base64!!!')).toBeNull();
  });
});

describe('htmlToPlainText — описание из Google Books', () => {
  it('убирает теги, оставляя текст', () => {
    expect(htmlToPlainText('<p>Роман <b>о</b> Вратах</p>')).toBe('Роман о Вратах');
  });

  it('переводит абзацы и <br> в переводы строк', () => {
    const html = '<p>Первый абзац</p><p>Второй абзац</p>';
    expect(htmlToPlainText(html)).toBe('Первый абзац\n\nВторой абзац');
  });

  it('раскрывает html-сущности', () => {
    expect(htmlToPlainText('Кавычки: &quot;да&quot; &amp; &laquo;нет&raquo;')).toBe(
      'Кавычки: "да" & «нет»',
    );
  });

  it('раскрывает числовые сущности', () => {
    expect(htmlToPlainText('&#1055;ривет')).toBe('Привет');
  });

  it('не оставляет более одной пустой строки подряд', () => {
    expect(htmlToPlainText('<p>А</p><br><br><br><p>Б</p>')).toBe('А\n\nБ');
  });

  it('обычный текст не портит', () => {
    expect(htmlToPlainText('Просто описание книги.')).toBe('Просто описание книги.');
  });
});

describe('обложки', () => {
  it('обложка Google уходит через наш маршрут, а не напрямую', () => {
    // Прямая ссылка на books.google.com не грузится у читателей, чей
    // провайдер режет google.com по SNI.
    const url = resolveCoverUrl(
      book({
        source: 'google',
        sourceId: 'jBiIQlevopYC',
        coverUrl: 'https://books.google.com/books/content?id=jBiIQlevopYC',
      }),
    );
    expect(url).toMatch(/^\/api\/cover\?/);
    expect(url).toContain('g=jBiIQlevopYC');
  });

  it('в запрос кладутся все известные зацепки сразу', () => {
    // Маршрут переберет их сам и вернет первую настоящую картинку.
    const url = resolveCoverUrl(
      book({
        source: 'google',
        sourceId: 'jBiIQlevopYC',
        coverUrl: 'https://books.google.com/books/content?id=jBiIQlevopYC',
        isbn13: '9785457151741',
      }),
    );
    expect(url).toContain('u=');
    expect(url).toContain('g=jBiIQlevopYC');
    expect(url).toContain('isbn=9785457151741');
  });

  it('чужая обложка с постороннего хоста отдается как есть', () => {
    // Ручное добавление: белый список такую ссылку не пропустит,
    // а гнать ее через себя незачем.
    const url = resolveCoverUrl(
      book({ coverUrl: 'https://example.org/cover.jpg', source: 'local' }),
    );
    expect(url).toBe('https://example.org/cover.jpg');
  });

  it('без обложки, но с ISBN - просим по ISBN', () => {
    const url = resolveCoverUrl(book({ coverUrl: null, isbn13: '9785457151741' }));
    expect(url).toContain('isbn=9785457151741');
  });

  it('размер передается маршруту', () => {
    const url = resolveCoverUrl(book({ isbn13: '9785457151741' }), 'l');
    expect(url).toContain('size=l');
  });

  it('просить нечего - null, покажем плейсхолдер', () => {
    expect(resolveCoverUrl(book({ coverUrl: null, source: 'local' }))).toBeNull();
  });

  it('белый список хостов закрыт для посторонних', () => {
    expect(isProxiedHost('https://books.google.com/x')).toBe(true);
    expect(isProxiedHost('https://covers.openlibrary.org/x')).toBe(true);
    expect(isProxiedHost('https://evil.example/x')).toBe(false);
    expect(isProxiedHost('не ссылка')).toBe(false);
  });
});

describe('блок «Об издании»', () => {
  it('полная дата приводится к читаемому виду', () => {
    expect(formatPublishedDate('2010-07-20')).toBe('20 июля 2010 г.');
  });

  it('год остаётся годом', () => {
    expect(formatPublishedDate('2002')).toBe('2002');
  });

  it('год с месяцем читается словами', () => {
    expect(formatPublishedDate('2010-07')).toBe('Июля 2010 г.');
  });

  it('собирает только известные факты', () => {
    const facts = buildEditionFacts(
      book({
        publisher: 'АСТ',
        publishedDate: '2010',
        pageCount: 1326,
        language: 'ru',
        isbn13: '9785457151741',
      }),
    );
    const labels = facts.map((f) => f.label);
    expect(labels).toContain('Издательство');
    expect(labels).toContain('Язык');
    expect(facts.find((f) => f.label === 'Язык')?.value).toBe('Русский');
    expect(facts.find((f) => f.label === 'Объем')?.value).toBe('1326 страниц');
  });

  it('пустая книга не даёт ни одной строки', () => {
    expect(buildEditionFacts(book({}))).toHaveLength(0);
  });
});

describe('обложки из базы', () => {
  it('сохраненный адрес Google уходит через наш маршрут', () => {
    // В cover_url лежат прямые адреса, сохраненные при добавлении книги.
    const url = proxiedCoverUrl(
      'https://books.google.com/books/content?id=A&zoom=1',
    );
    expect(url).toMatch(/^\/api\/cover\?u=/);
  });

  it('свой адрес остается как есть', () => {
    expect(proxiedCoverUrl('/api/cover?g=A')).toBe('/api/cover?g=A');
  });

  it('посторонний хост не заворачиваем - белый список его не пропустит', () => {
    expect(proxiedCoverUrl('https://example.org/c.jpg')).toBe(
      'https://example.org/c.jpg',
    );
  });

  it('пусто на входе - пусто на выходе', () => {
    expect(proxiedCoverUrl(null)).toBeNull();
    expect(proxiedCoverUrl(undefined)).toBeNull();
  });

  it('размер передается маршруту', () => {
    expect(proxiedCoverUrl('https://covers.openlibrary.org/b/id/1-M.jpg', 'l')).toContain(
      'size=l',
    );
  });
});

describe('жанры Google в человеческом виде', () => {
  it('берется самый точный уровень пути BISAC', () => {
    // Именно так пришли жанры «Спектра» из живого ответа API.
    expect(localizeGenre('Fiction / Science Fiction / Space Opera')).toBe(
      'Космическая опера',
    );
  });

  it('пустой уровень General пропускается', () => {
    expect(localizeGenre('Literary Collections / General')).toBe(
      'Литературные сборники',
    );
  });

  it('незнакомый поджанр поднимается до знакомого уровня', () => {
    // Лучше показать «Художественная литература», чем английское
    // «Nautical» посреди русской страницы.
    expect(localizeGenre('Fiction / Nautical')).toBe('Художественная литература');
    expect(localizeGenre('Philosophy / Zzz')).toBe('Философия');
  });

  it('если незнаком весь путь - показываем самый точный уровень, а не пустоту', () => {
    expect(localizeGenre('Nautical / Zzz')).toBe('Zzz');
  });

  it('повторы схлопываются', () => {
    // Два разных пути BISAC часто сходятся в один жанр.
    const list = localizeGenres([
      'Fiction / Science Fiction / General',
      'Juvenile Fiction / Science Fiction',
    ]);
    expect(list).toEqual(['Научная фантастика']);
  });

  it('пустой список остается пустым', () => {
    expect(localizeGenres([])).toEqual([]);
  });
});

describe('обложка книги из своего каталога', () => {
  it('собирается по сохраненному идентификатору тома', () => {
    // В каталоге лежит google_books_id, а готовой ссылки нет: в ней был
    // бы зашит размер, а книга показывается и мелко, и крупно.
    const url = resolveCoverUrl(
      book({
        source: 'local',
        sourceId: 'uuid-каталога',
        googleVolumeId: 'jBiIQlevopYC',
        coverUrl: null,
      }),
      'l',
    );
    expect(url).toContain('g=jBiIQlevopYC');
    expect(url).toContain('size=l');
  });
});

describe('пропорции обложки', () => {
  // Заголовок JPEG: FFD8 + сегмент SOF0 с размерами.
  function jpeg(width: number, height: number): Buffer {
    const buf = Buffer.alloc(20);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    buf[3] = 0xc0;
    buf.writeUInt16BE(11, 4); // длина сегмента
    buf[6] = 8; // точность
    buf.writeUInt16BE(height, 7);
    buf.writeUInt16BE(width, 9);
    return buf;
  }

  it('размеры читаются из заголовка JPEG', () => {
    expect(readImageSize(jpeg(800, 1211))).toEqual({ width: 800, height: 1211 });
  });

  it('обычная книжная обложка проходит', () => {
    expect(looksLikeCover({ width: 800, height: 1211 })).toBe(true);
    expect(looksLikeCover({ width: 300, height: 454 })).toBe(true);
  });

  it('широкий разворот отвергается', () => {
    // Именно из-за таких на карточке появлялся гигантский кусок буквы:
    // кадрирование по 2:3 вырезает из разворота случайный лоскут.
    expect(looksLikeCover({ width: 1200, height: 400 })).toBe(false);
  });

  it('слишком вытянутая полоска отвергается', () => {
    expect(looksLikeCover({ width: 200, height: 900 })).toBe(false);
  });

  it('крошечная картинка отвергается', () => {
    expect(looksLikeCover({ width: 40, height: 60 })).toBe(false);
  });

  it('неразобранный формат не отвергаем - лучше показать, чем потерять', () => {
    expect(looksLikeCover(null)).toBe(true);
    expect(readImageSize(Buffer.from('не картинка'))).toBeNull();
  });
});

describe('обложка по названию, когда ссылки нет', () => {
  it('запрос собирается из названия и автора', () => {
    const url = proxiedCoverUrl(null, 'm', 'Мастер и Маргарита', 'Михаил Булгаков');
    expect(url).toContain('t=');
    expect(url).toContain('a=');
  });

  it('без названия просить нечего', () => {
    expect(proxiedCoverUrl(null, 'm', null)).toBeNull();
  });

  it('к готовой ссылке название добавляется запасным вариантом', () => {
    const url = proxiedCoverUrl(
      'https://covers.openlibrary.org/b/id/1-M.jpg',
      'm',
      'Спектр',
      'Сергей Лукьяненко',
    );
    expect(url).toContain('u=');
    expect(url).toContain('t=');
  });
});

describe('осмысленность совпадения', () => {
  // Все примеры - из живой выдачи по запросу «Сто лет одиночества».
  const query = 'Сто лет одиночества';

  function ok(target: string) {
    return matchesQuery(fuzzyMatch(query, target));
  }

  it('сама книга проходит', () => {
    expect(ok('Сто лет одиночества: роман')).toBe(true);
    expect(ok('Сто лет одиночества')).toBe(true);
  });

  it('совпадение одним словом из трех отсекается', () => {
    // «лет» входит подстрокой в «Летов» и набирало 0.95 за один токен.
    expect(ok('Егор Летов. Моя оборона')).toBe(false);
  });

  it('главное слово запроса обязано найтись', () => {
    // Покрытие 2 из 3, но мимо идет как раз «одиночества».
    expect(ok('Русские поэты за сто лет')).toBe(false);
  });

  it('прочий мусор из той же выдачи отсекается', () => {
    expect(ok('Нюх потеряла. Хроники одного карантина')).toBe(false);
    expect(ok('Русский Репортер No16-17/2014')).toBe(false);
    expect(ok('Семья и школа')).toBe(false);
  });

  it('опечатка в главном слове по-прежнему прощается', () => {
    expect(ok('Сто лет одиночевства')).toBe(true);
  });

  it('короткий запрос проверяется только покрытием', () => {
    // У запроса в одно слово «главное слово» - оно же единственное.
    expect(matchesQuery(fuzzyMatch('Лавр', 'Лавр'))).toBe(true);
    expect(matchesQuery(fuzzyMatch('Лавр', 'Обелиск'))).toBe(false);
  });

  it('поиск по автору не ломается', () => {
    expect(matchesQuery(fuzzyMatch('Габриэль Гарсиа Маркес', 'Габриэль Гарсиа Маркес'))).toBe(
      true,
    );
    expect(matchesQuery(fuzzyMatch('Пушкин', 'Александр Пушкин'))).toBe(true);
  });
});

describe('заглушка Google вместо обложки', () => {
  it('у тома без обложки идентификатор не запрашивается', () => {
    // Google на такой запрос отвечает 200 и отдает картинку с надписью
    // «image not available» - она встанет в карточку как настоящая.
    const url = resolveCoverUrl(
      book({
        source: 'google',
        sourceId: 'jBiIQlevopYC',
        coverUrl: null,
        isbn13: '9785457151741',
        title: 'Спектр',
      }),
    );
    expect(url).not.toContain('g=');
    expect(url).toContain('isbn=9785457151741');
  });

  it('у тома с обложкой идентификатор запрашивается', () => {
    const url = resolveCoverUrl(
      book({
        source: 'google',
        sourceId: 'jBiIQlevopYC',
        coverUrl: 'https://books.google.com/books/content?id=jBiIQlevopYC',
      }),
    );
    expect(url).toContain('g=jBiIQlevopYC');
  });
});
