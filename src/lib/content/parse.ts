/**
 * Разбор списка книг, который человек вводит руками.
 *
 * Отдельным модулем, потому что нужен в трех местах сразу: в админке,
 * в серверном действии и в тестах. В actions.ts ему нельзя - там
 * 'use server', и экспортировать оттуда можно только асинхронное.
 */

/** ISBN - 10 или 13 цифр, у ISBN-10 последний знак может быть X. */
export function looksLikeIsbnLine(value: string): boolean {
  const digits = value.replace(/[\s-]/g, '');
  return /^\d{9}[\dXx]$/.test(digits) || /^\d{13}$/.test(digits);
}

export interface ParsedBookLine {
  payload: Record<string, string>;
  /** Ключ повтора: одна и та же книга не встанет в очередь дважды. */
  key: string;
}

/**
 * Разбирает строку списка книг.
 *
 * Три формы: голый ISBN, «Название - Автор» и свободный запрос.
 * Разделителем взят дефис с пробелами по краям: в названиях дефис
 * бывает («Ай-Петри», «Жизнь и судьба - роман»), но почти всегда без
 * пробелов вокруг, так что спутать трудно.
 *
 * Пустые строки и строки с решеткой пропускаются - список удобно
 * держать в файле с комментариями.
 */
export function parseBookLine(line: string): ParsedBookLine | null {
  const value = line.trim();
  if (!value || value.startsWith('#')) return null;

  // Ссылка на карточку издательства - самый точный вход, поэтому
  // проверяется первой.
  if (/^https?:\/\//i.test(value)) {
    return { payload: { url: value }, key: value.toLowerCase() };
  }

  if (looksLikeIsbnLine(value)) {
    const isbn = value.replace(/[\s-]/g, '');
    return { payload: { isbn }, key: isbn };
  }

  const parts = value.split(/\s+-\s+/);
  if (parts.length >= 2) {
    const title = parts[0].trim();
    const author = parts.slice(1).join(' - ').trim();
    return { payload: { title, author }, key: `${title}|${author}`.toLowerCase() };
  }

  return { payload: { query: value }, key: value.toLowerCase() };
}

/** Разбирает весь список разом. */
export function parseBookList(raw: string): ParsedBookLine[] {
  return raw
    .split('\n')
    .map(parseBookLine)
    .filter((parsed): parsed is ParsedBookLine => parsed !== null);
}
