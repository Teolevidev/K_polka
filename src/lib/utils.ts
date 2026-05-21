import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Объединяет классы Tailwind с разрешением конфликтов. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Склонение русских существительных по числу: plural(5, 'книга', 'книги', 'книг'). */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/** Безопасно усекает строку до заданной длины с многоточием. */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max).trimEnd() + '…';
}

/** Форматирует число с разделителями разрядов (1234 → "1 234"). */
export function formatNumber(n: number, locale = 'ru-RU'): string {
  return new Intl.NumberFormat(locale).format(n);
}
