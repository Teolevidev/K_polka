import { describe, it, expect } from 'vitest';
import {
  applyTextRules,
  findTextRuleViolations,
  slugify,
  SLUG_RE,
  checkArticleDraft,
  countWords,
} from '@/lib/content/guards';
import { parseBookLine, parseBookList } from '@/lib/content/parse';
import { buildIngestQuery } from '@/lib/content/ingest';

/**
 * Тесты контент-агента.
 *
 * Проверяется то, что решает судьбу текста до всякой модели: правила
 * проекта, адрес статьи и содержательные проверки черновика. Сам вызов
 * модели тестами не покрыть - там каждый ответ новый.
 */

describe('правила текста', () => {
  it('заменяет «е» с точками на обычную, сохраняя регистр', () => {
    expect(applyTextRules('Ёжик ещё раз')).toBe('Ежик еще раз');
  });

  it('заменяет длинное и среднее тире на дефис', () => {
    expect(applyTextRules('книга — это окно')).toBe('книга - это окно');
    expect(applyTextRules('1941–1945')).toBe('1941-1945');
  });

  it('схлопывает лишние пустые строки', () => {
    expect(applyTextRules('первый\n\n\n\nвторой')).toBe('первый\n\nвторой');
  });

  it('убирает неразрывные пробелы', () => {
    expect(applyTextRules('текст дальше')).toBe('текст дальше');
  });

  it('после причесывания нарушений не остается', () => {
    const dirty = 'Ёлки — палки, ещё раз';
    expect(findTextRuleViolations(dirty)).toHaveLength(2);
    expect(findTextRuleViolations(applyTextRules(dirty))).toHaveLength(0);
  });

  it('не залипает между вызовами на одном и том же тексте', () => {
    // Регулярки объявлены с флагом g, и без сброса lastIndex второй
    // вызов молча вернул бы пусто.
    const text = 'Ёж';
    expect(findTextRuleViolations(text)).toHaveLength(1);
    expect(findTextRuleViolations(text)).toHaveLength(1);
  });
});

describe('slug', () => {
  it('транслитерирует русский заголовок', () => {
    expect(slugify('Лавр и время')).toBe('lavr-i-vremya');
  });

  it('переживает «е» с точками и знаки препинания', () => {
    expect(slugify('Ещё раз про «Щегла»!')).toBe('esche-raz-pro-schegla');
  });

  it('режет длинный заголовок по границе слова', () => {
    const slug = slugify(
      'Очень длинный заголовок про книги которые стоит перечитать этой зимой',
    );
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('всегда дает адрес, который примет saveArticle', () => {
    for (const title of ['Лавр', 'Сто лет одиночества', 'Ещё раз про «Щегла»']) {
      expect(SLUG_RE.test(slugify(title))).toBe(true);
    }
  });
});

describe('разбор списка книг', () => {
  it('узнает ISBN-13 и чистит его от дефисов', () => {
    expect(parseBookLine('978-5-17-132613-5')?.payload).toEqual({
      isbn: '9785171326135',
    });
  });

  it('узнает ISBN-10 с X на конце', () => {
    expect(parseBookLine('080442957X')?.payload).toEqual({ isbn: '080442957X' });
  });

  it('разбирает «Название - Автор»', () => {
    expect(parseBookLine('Лавр - Евгений Водолазкин')?.payload).toEqual({
      title: 'Лавр',
      author: 'Евгений Водолазкин',
    });
  });

  it('не путает дефис внутри названия с разделителем', () => {
    expect(parseBookLine('Ай-Петри')?.payload).toEqual({ query: 'Ай-Петри' });
  });

  it('узнает ссылку на карточку издательства', () => {
    const url = 'https://ast.ru/book/lavr-894062/';
    expect(parseBookLine(url)?.payload).toEqual({ url });
  });

  it('не разбирает ссылку как «Название - Автор»', () => {
    // В адресе бывают дефисы с пробелами вокруг после копирования,
    // и без проверки на ссылку первой строка уехала бы в текстовый поиск.
    const url = 'https://www.eksmo.ru/book/sad - 123/';
    expect(parseBookLine(url)?.payload).toEqual({ url });
  });

  it('пропускает пустые строки и комментарии', () => {
    const list = parseBookList('# список\n\n9785171326135\n\nЛавр - Водолазкин');
    expect(list).toHaveLength(2);
  });

  it('дает одинаковый ключ повтора одной и той же книге', () => {
    const a = parseBookLine('Лавр - Евгений Водолазкин');
    const b = parseBookLine('лавр - евгений водолазкин');
    expect(a?.key).toBe(b?.key);
  });
});

describe('запрос на заведение книги', () => {
  it('по ISBN ищет строго по ISBN', () => {
    expect(buildIngestQuery({ isbn: '978-5-17-132613-5' })).toEqual({
      query: '9785171326135',
      isbn: true,
    });
  });

  it('склеивает название с автором', () => {
    expect(buildIngestQuery({ title: 'Лавр', author: 'Водолазкин' })).toEqual({
      query: 'Лавр Водолазкин',
      isbn: false,
    });
  });

  it('падает, когда искать нечего', () => {
    expect(() => buildIngestQuery({})).toThrow();
  });

  it('не пускает кривой ISBN в текстовый поиск', () => {
    // Иначе в каталог приедет случайная книга, а человек будет уверен,
    // что завел ту, чей номер переписал с обложки.
    expect(() => buildIngestQuery({ isbn: '12345' })).toThrow(/не похож на ISBN/);
  });
});

describe('проверка черновика', () => {
  const body = 'Абзац про книгу. '.repeat(80);

  it('пропускает нормальный текст', () => {
    const check = checkArticleDraft({
      title: 'Лавр: роман о времени',
      excerpt: 'Коротко о книге',
      bodyMd: `${body} Водолазкин пишет про Лавра.`,
      book: { title: 'Лавр', authors: ['Евгений Водолазкин'] },
    });
    expect(check.errors).toHaveLength(0);
  });

  it('ловит текст, в котором не назван автор книги', () => {
    const check = checkArticleDraft({
      title: 'Роман о времени',
      excerpt: 'Коротко',
      bodyMd: body,
      book: { title: 'Лавр', authors: ['Евгений Водолазкин'] },
    });
    expect(check.errors.join(' ')).toContain('не назван автор');
  });

  it('ловит короткий текст', () => {
    const check = checkArticleDraft({
      title: 'Заголовок',
      excerpt: '',
      bodyMd: 'Слишком коротко',
    });
    expect(check.errors.join(' ')).toContain('короче');
  });

  it('ловит ответ ассистента вместо статьи', () => {
    const check = checkArticleDraft({
      title: 'Заголовок статьи',
      excerpt: 'Коротко',
      bodyMd: `Конечно, вот обзор книги. ${body}`,
    });
    expect(check.errors.join(' ')).toContain('ответа ассистента');
  });

  it('ловит нарушения правил текста', () => {
    const check = checkArticleDraft({
      title: 'Ещё один обзор',
      excerpt: 'Коротко',
      bodyMd: body,
    });
    expect(check.errors.join(' ')).toContain('с точками');
  });

  it('замечание, а не ошибка, когда не названа книга', () => {
    const check = checkArticleDraft({
      title: 'Роман Водолазкина',
      excerpt: 'Коротко',
      bodyMd: `${body} Водолазкин пишет хорошо.`,
      book: { title: 'Соловьев и Ларионов', authors: ['Евгений Водолазкин'] },
    });
    expect(check.errors).toHaveLength(0);
    expect(check.warnings.join(' ')).toContain('не упомянуто название');
  });
});

describe('объем в словах', () => {
  it('считает слова, а не куски разметки', () => {
    expect(countWords('## Подзаголовок\n\n- первый пункт\n- второй пункт')).toBe(5);
  });

  it('не считает ограждения кода', () => {
    expect(countWords('текст\n```\nconst a = 1;\n```\nеще текст')).toBe(3);
  });

  it('роняет текст длиннее потолка', () => {
    const check = checkArticleDraft({
      title: 'Обзор книги',
      excerpt: 'Коротко',
      bodyMd: 'слово '.repeat(700),
      maxWords: 600,
    });
    expect(check.errors.join(' ')).toContain('длиннее 600 слов');
  });

  it('пропускает текст в границах', () => {
    const check = checkArticleDraft({
      title: 'Обзор книги',
      excerpt: 'Коротко',
      bodyMd: 'слово '.repeat(400),
      minWords: 250,
      maxWords: 600,
    });
    expect(check.errors).toHaveLength(0);
  });
});

describe('голос критика', () => {
  const body = 'Разбор книги по существу. '.repeat(60);

  it('роняет выдуманный личный опыт', () => {
    const check = checkArticleDraft({
      title: 'Обзор книги',
      excerpt: 'Коротко',
      bodyMd: `Я помню, как читал это впервые. ${body}`,
    });
    expect(check.errors.join(' ')).toContain('личный опыт');
  });

  it('помечает рекламные штампы замечанием, но не роняет', () => {
    const check = checkArticleDraft({
      title: 'Обзор книги',
      excerpt: 'Коротко',
      bodyMd: `Этот бестселлер не оставит равнодушным никого. ${body}`,
    });
    expect(check.errors).toHaveLength(0);
    expect(check.warnings.join(' ')).toContain('рекламные штампы');
  });

  it('не придирается к нормальному критическому тексту', () => {
    const check = checkArticleDraft({
      title: 'Обзор книги',
      excerpt: 'Коротко',
      bodyMd: `Книга стоит в одном ряду с ранней прозой автора. ${body}`,
    });
    expect(check.errors).toHaveLength(0);
    expect(check.warnings.filter((w) => w.includes('штампы'))).toHaveLength(0);
  });
});
