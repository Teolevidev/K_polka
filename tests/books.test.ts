import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  levenshtein,
  similarity,
  fuzzyScore,
  detectScript,
  preferredLanguage,
} from '@/lib/books/normalize';
import { scoreBook, compareResults } from '@/lib/books/search';
import type { NormalizedBook, SearchResultBook } from '@/lib/books/types';
import {
  isValidIsbn10,
  isValidIsbn13,
  isbn10to13,
  looksLikeIsbn,
  detectQueryKind,
} from '@/lib/books/isbn';
import { encodeBookRef, decodeBookRef } from '@/lib/books/ref';

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
