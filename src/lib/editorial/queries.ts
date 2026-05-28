import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { mondayOf } from './week';

export interface EditorialPick {
  id: string;
  bookRef: string;
  title: string;
  authors: string;
  coverUrl: string | null;
  featuredWeek: string | null;
  createdAt: string;
}

const PICK_SELECT =
  'id, book_ref, title, authors, cover_url, featured_week, created_at';

interface PickRow {
  id: string;
  book_ref: string;
  title: string;
  authors: string;
  cover_url: string | null;
  featured_week: string | null;
  created_at: string;
}

function toPick(row: PickRow): EditorialPick {
  return {
    id: row.id,
    bookRef: row.book_ref,
    title: row.title,
    authors: row.authors,
    coverUrl: row.cover_url,
    featuredWeek: row.featured_week,
    createdAt: row.created_at,
  };
}

/**
 * Активная подборка для главной (5 книг текущей недели).
 * Если на эту неделю ещё ничего не назначено — пробует автоматически
 * закрепить за этой неделей до 5 «свежих» (featured_week IS NULL) книг.
 * Если их нет — возвращает книги последней непустой недели.
 */
export async function getCurrentEditorialPicks(): Promise<EditorialPick[]> {
  const supabase = await createSupabaseServerClient();
  const thisMonday = mondayOf();

  // 1. Уже есть подборка на эту неделю?
  const { data: thisWeek } = await supabase
    .from('editorial_picks')
    .select(PICK_SELECT)
    .eq('featured_week', thisMonday)
    .order('created_at', { ascending: true });

  if ((thisWeek?.length ?? 0) >= 1) {
    return (thisWeek as PickRow[]).slice(0, 5).map(toPick);
  }

  // 2. Пробуем закрепить «свежие» книги за этой неделей (lazy rotation).
  try {
    await rotateEditorialPicks(thisMonday, 5);
  } catch {
    // Без service_role ключа ротация невозможна — это норма.
  }

  // 3. Перечитываем — после ротации могут появиться записи.
  const { data: afterRotate } = await supabase
    .from('editorial_picks')
    .select(PICK_SELECT)
    .eq('featured_week', thisMonday)
    .order('created_at', { ascending: true });

  if ((afterRotate?.length ?? 0) >= 1) {
    return (afterRotate as PickRow[]).slice(0, 5).map(toPick);
  }

  // 4. Fallback: книги последней непустой недели.
  const { data: latest } = await supabase
    .from('editorial_picks')
    .select(PICK_SELECT)
    .not('featured_week', 'is', null)
    .order('featured_week', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(20);

  if (!latest?.length) return [];

  const latestWeek = (latest as PickRow[])[0].featured_week;
  return (latest as PickRow[])
    .filter((r) => r.featured_week === latestWeek)
    .slice(0, 5)
    .map(toPick);
}

/**
 * Сдвигает ротацию: берёт до `limit` записей с featured_week IS NULL
 * и закрепляет за заданной неделей. Использует service_role —
 * нужен SUPABASE_SERVICE_ROLE_KEY.
 */
export async function rotateEditorialPicks(
  weekMonday: string,
  limit = 5,
): Promise<number> {
  const admin = createSupabaseAdminClient();

  const { data: fresh } = await admin
    .from('editorial_picks')
    .select('id')
    .is('featured_week', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  const ids = ((fresh ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return 0;

  const { error } = await admin
    .from('editorial_picks')
    .update({ featured_week: weekMonday })
    .in('id', ids);

  if (error) throw error;
  return ids.length;
}

/** Все маркированные книги (для админ-страницы). */
export async function getAllEditorialPicks(): Promise<EditorialPick[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('editorial_picks')
    .select(PICK_SELECT)
    .order('created_at', { ascending: false });
  return ((data ?? []) as PickRow[]).map(toPick);
}
