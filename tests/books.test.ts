import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  levenshtein,
  similarity,
  fuzzyScore,
} from '@/lib/books/normalize';
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
