import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from './env';

/**
 * Supabase-клиент с service_role-ключом.
 *
 * Обходит RLS — использовать ТОЛЬКО на сервере и только для системных
 * операций (наполнение каталога книг, ротация подборок). Перед любой
 * записью пользовательских данных проверяем личность через getCurrentUser().
 */
export function createSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY не задан');
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
