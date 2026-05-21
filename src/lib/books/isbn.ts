import type { QueryKind } from './types';

/** Убирает дефисы и пробелы из строки ISBN. */
export function cleanIsbn(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

/** Проверяет корректность ISBN-10 по контрольной сумме. */
export function isValidIsbn10(raw: string): boolean {
  const isbn = cleanIsbn(raw);
  if (!/^[0-9]{9}[0-9X]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const char = isbn[i];
    const value = char === 'X' ? 10 : Number(char);
    sum += value * (10 - i);
  }
  return sum % 11 === 0;
}

/** Проверяет корректность ISBN-13 по контрольной сумме. */
export function isValidIsbn13(raw: string): boolean {
  const isbn = cleanIsbn(raw);
  if (!/^[0-9]{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

/** Конвертирует валидный ISBN-10 в ISBN-13. */
export function isbn10to13(raw: string): string | null {
  const isbn = cleanIsbn(raw);
  if (!isValidIsbn10(isbn)) return null;
  const core = '978' + isbn.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return core + check;
}

/** Возвращает true, если строка похожа на ISBN (10 или 13 цифр). */
export function looksLikeIsbn(raw: string): boolean {
  const cleaned = cleanIsbn(raw);
  return /^[0-9]{9}[0-9X]$/.test(cleaned) || /^[0-9]{13}$/.test(cleaned);
}

/** Эвристика: определяет вид поискового запроса. */
export function detectQueryKind(query: string): QueryKind {
  return looksLikeIsbn(query) ? 'isbn' : 'free-text';
}
