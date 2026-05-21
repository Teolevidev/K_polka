/**
 * Конфигурация Supabase.
 *
 * Приложение собирается и запускается даже без настроенного Supabase —
 * разделы, требующие БД, в этом случае показывают подсказку по настройке.
 * Это позволяет развернуть и посмотреть приложение до создания проекта.
 */

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** true, если заданы публичные ключи Supabase. */
export function isSupabaseConfigured(): boolean {
  return (
    supabaseUrl.startsWith('http') &&
    supabaseUrl.includes('supabase') &&
    supabaseAnonKey.length > 20
  );
}
