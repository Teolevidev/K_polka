'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';

export interface ActionResult {
  ok: boolean;
  error?: string;
  url?: string;
}

const MAX_SIZE = 2 * 1024 * 1024; // 2 МБ
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Загружает аватар в Supabase Storage (bucket `avatars`) и обновляет
 * profile.avatar_url. Файл кладётся в папку, имя которой совпадает с UUID
 * пользователя — этого требует RLS-политика.
 */
export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };

  const file = formData.get('avatar');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Файл не выбран' };
  }
  if (file.size > MAX_SIZE) {
    return { ok: false, error: 'Размер до 2 МБ' };
  }
  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    return { ok: false, error: 'Допустимы JPG, PNG, WEBP, GIF' };
  }

  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const supabase = await createSupabaseServerClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  const url = pub.publicUrl;

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (profileErr) return { ok: false, error: profileErr.message };

  revalidatePath('/profile');
  revalidatePath('/profile/edit');
  return { ok: true, url };
}

/** Сбрасывает аватар (avatar_url → null). Файлы из Storage не удаляем. */
export async function clearAvatar(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/profile');
  revalidatePath('/profile/edit');
  return { ok: true };
}
