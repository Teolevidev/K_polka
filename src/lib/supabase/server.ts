import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseUrl, supabaseAnonKey } from './env';

/**
 * Supabase-клиент для серверных компонентов и server actions.
 * Привязан к cookie текущего запроса — ходит в БД от имени пользователя
 * (RLS-политики применяются автоматически).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll вызван из серверного компонента — игнорируем:
          // обновление сессии выполнит middleware.
        }
      },
    },
  });
}

/** Возвращает текущего пользователя или null. */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
