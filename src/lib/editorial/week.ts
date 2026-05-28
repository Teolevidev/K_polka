/**
 * Утилиты для работы с «неделями» при ротации редакционной подборки.
 * Неделя начинается с понедельника (ISO).
 */

/** Возвращает понедельник недели для заданной даты в формате YYYY-MM-DD. */
export function mondayOf(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=вс, 1=пн, …
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
