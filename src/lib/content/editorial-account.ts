import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Аккаунт, от лица которого пишет агент.
 *
 * Тексты агента должны быть подписаны, и подписаны честно. В закрытом
 * клубе на полтора десятка знакомых выдуманный участник со своим
 * мнением вскроется на первой же живой встрече - и подозрение падет
 * заодно на все настоящие отзывы. Поэтому автор один, он называется
 * «Редакция», и на его профиле стоит флаг is_editorial.
 *
 * Технически это обычный пользователь: articles.author_id смотрит на
 * profiles, а profiles - на auth.users. Обойти цепочку нельзя, да и не
 * нужно: у редакции есть своя страница, свои тексты и своя подпись.
 */

/** Логин редакции. По нему же ищется профиль - он уникален. */
export const EDITORIAL_USERNAME = 'redakciya';

const EDITORIAL_DISPLAY_NAME = 'Редакция';

const EDITORIAL_BIO =
  'Редакционные обзоры и подборки «Книжной полки». Тексты готовит редакция ' +
  'клуба с помощью ИИ, публикует человек.';

/** Почта редакции. Настраивается: на своем домене выглядит опрятнее. */
function editorialEmail(): string {
  return process.env.CONTENT_AGENT_EMAIL ?? 'redakciya@knizhnaya-polka.local';
}

export interface EditorialAuthor {
  id: string;
  username: string;
  displayName: string;
  /** Аккаунт только что создан - это стоит сказать вслух в логе. */
  created: boolean;
}

/**
 * Возвращает профиль редакции, создавая его при первом обращении.
 *
 * Идемпотентна: второй вызов находит готовый профиль и ничего не
 * трогает. Поэтому ее можно звать перед каждым текстовым заданием и не
 * держать отдельного шага установки.
 */
export async function ensureEditorialAuthor(
  client?: SupabaseClient,
): Promise<EditorialAuthor> {
  const supabase = client ?? createSupabaseAdminClient();

  const { data: existing } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .eq('username', EDITORIAL_USERNAME)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id as string,
      username: existing.username as string,
      displayName: existing.display_name as string,
      created: false,
    };
  }

  // Профиля нет - заводим пользователя. Триггер on_auth_user_created
  // сам создаст строку в profiles, но с производным username вида
  // «redakciya_1a2b3c», поэтому сразу после вставки ее правим.
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: editorialEmail(),
    email_confirm: true,
    user_metadata: { full_name: EDITORIAL_DISPLAY_NAME },
  });

  if (error || !created.user) {
    throw new Error(
      `Не удалось создать аккаунт редакции: ${error?.message ?? 'пустой ответ'}`,
    );
  }

  const userId = created.user.id;
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      username: EDITORIAL_USERNAME,
      display_name: EDITORIAL_DISPLAY_NAME,
      bio: EDITORIAL_BIO,
      is_editorial: true,
      // Страница редакции открыта: ее тексты для того и пишутся.
      is_private: false,
    })
    .eq('id', userId);

  if (updateError) {
    throw new Error(`Аккаунт редакции создан, но профиль не заполнен: ${updateError.message}`);
  }

  return {
    id: userId,
    username: EDITORIAL_USERNAME,
    displayName: EDITORIAL_DISPLAY_NAME,
    created: true,
  };
}
