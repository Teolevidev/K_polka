/**
 * Нормализация текста и fuzzy-сопоставление.
 *
 * Используется для ранжирования результатов поиска из внешних API:
 * терпимо к опечаткам в имени автора и названии книги.
 * (Поиск по локальной БД дополнительно использует pg_trgm — см. миграции.)
 */

// Комбинируемые диакритические знаки Unicode (U+0300..U+036F).
// Создаём через конструктор, чтобы в исходнике не было невидимых символов.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

// Плейсхолдер (управляющий символ U+0001) для защиты кириллической «й».
const J_GUARD = String.fromCharCode(1);
const J_GUARD_RE = new RegExp(J_GUARD, 'g');

/**
 * Приводит текст к каноничному виду:
 * нижний регистр, ё→е, удаление латинской диакритики, схлопывание пробелов.
 *
 * Тонкость: NFD-декомпозиция разбивает кириллическую «й» на «и» + бреве.
 * Чтобы удаление диакритики не превратило «й» в «и», временно защищаем её
 * плейсхолдером. «ё» заменяется на «е» до нормализации.
 */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/й/g, J_GUARD)
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(J_GUARD_RE, 'й')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Разбивает нормализованный текст на токены-слова. */
export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  return normalized.length ? normalized.split(' ') : [];
}

/** Расстояние Левенштейна между двумя строками. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // вставка
        prev[j] + 1, // удаление
        prev[j - 1] + cost, // замена
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Похожесть двух строк в диапазоне 0..1 (1 — идентичны). */
export function similarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

/**
 * Оценивает, насколько строка query соответствует target,
 * учитывая опечатки. Возвращает score 0..1.
 *
 * Алгоритм: для каждого токена запроса ищем лучший по похожести
 * токен в цели; усредняем. Точное вхождение подстроки даёт бонус.
 */
export function fuzzyScore(query: string, target: string): number {
  const queryTokens = tokenize(query);
  const targetTokens = tokenize(target);
  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;

  let totalBest = 0;
  for (const qt of queryTokens) {
    let best = 0;
    for (const tt of targetTokens) {
      const sim = similarity(qt, tt);
      if (sim > best) best = sim;
      // токен запроса как подстрока токена цели — почти точное совпадение
      if (tt.includes(qt) && qt.length >= 3) best = Math.max(best, 0.95);
    }
    totalBest += best;
  }
  let score = totalBest / queryTokens.length;

  // Бонус за полное вхождение нормализованного запроса в цель
  const nq = normalizeText(query);
  const nt = normalizeText(target);
  if (nt.includes(nq) && nq.length >= 3) {
    score = Math.min(1, score + 0.15);
  }
  return Number(score.toFixed(4));
}
