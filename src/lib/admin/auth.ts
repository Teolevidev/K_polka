import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';

export type AdminRole = 'admin' | 'moderator';

export interface AdminCheck {
  userId: string;
  role: AdminRole;
}

/**
 * Возвращает данные пользователя, если он админ или модератор,
 * иначе null. Используется на серверных страницах и в server actions.
 */
export async function getAdminContext(): Promise<AdminCheck | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = data?.role as string | undefined;
  if (role === 'admin' || role === 'moderator') {
    return { userId: user.id, role };
  }
  return null;
}
