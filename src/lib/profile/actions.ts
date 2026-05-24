'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface ProfileInput {
  displayName: string;
  username: string;
  bio: string;
  phone: string;
  gender: 'male' | 'female' | 'other' | '';
  birthYear: string;
  favoriteGenres: string[];
  dailyReminder: boolean;
  reminderChannel: 'email' | 'telegram';
  reminderTime: string;
  telegramUsername: string;
}

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

/** Сохраняет профиль пользователя. */
export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };

  const displayName = input.displayName.trim();
  const username = input.username.trim();

  if (displayName.length < 2) {
    return { ok: false, error: 'Имя слишком короткое' };
  }
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error: 'Никнейм: 3–30 символов, латиница, цифры, _ и .',
    };
  }

  let birthYear: number | null = null;
  if (input.birthYear.trim()) {
    const y = Number(input.birthYear);
    if (!Number.isInteger(y) || y < 1900 || y > 2025) {
      return { ok: false, error: 'Год рождения указан неверно' };
    }
    birthYear = y;
  }

  if (input.reminderChannel === 'telegram' && !input.telegramUsername.trim()) {
    return {
      ok: false,
      error: 'Укажите Telegram-аккаунт для напоминаний в Telegram',
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName,
      username,
      bio: input.bio.trim() || null,
      phone: input.phone.trim() || null,
      gender: input.gender || null,
      birth_year: birthYear,
      favorite_genres: input.favoriteGenres,
      daily_reminder: input.dailyReminder,
      reminder_channel: input.reminderChannel,
      reminder_time: input.reminderTime || '19:00',
      telegram_username: input.telegramUsername.trim() || null,
      onboarded: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Такой никнейм уже занят' };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/profile');
  revalidatePath('/');
  return { ok: true };
}

/** Устанавливает пароль (для входа без magic link). */
export async function updatePassword(password: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };
  if (password.length < 8) {
    return { ok: false, error: 'Пароль должен быть не короче 8 символов' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
