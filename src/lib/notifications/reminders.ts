import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from './email';
import { sendTelegram } from './telegram';

export interface ReminderRunResult {
  candidates: number;
  emailSent: number;
  telegramSent: number;
  emailSkipped: number;
  telegramSkipped: number;
  failures: number;
}

interface ProfileForReminder {
  id: string;
  display_name: string;
  reminder_channel: 'email' | 'telegram';
  telegram_username: string | null;
}

interface AuthUser {
  id: string;
  email?: string | null;
}

const SUBJECT = 'Время почитать — Книжная полка';

function bodyFor(name: string): { text: string; html: string } {
  const text = `Привет, ${name}!\n\nПора уделить немного времени книге. Загляните на «Книжную полку» и продолжите чтение.\n\nКнижная полка`;
  const html = `<p>Привет, ${name}!</p><p>Пора уделить немного времени книге. Загляните на <a href="${process.env.NEXT_PUBLIC_APP_URL ?? '#'}">«Книжную полку»</a> и продолжите чтение.</p><p>— Книжная полка</p>`;
  return { text, html };
}

/**
 * Рассылает ежедневные напоминания всем, у кого включён daily_reminder.
 * Использует service_role: читает email из auth.users (RLS не пускает анонимно).
 */
export async function runDailyReminders(): Promise<ReminderRunResult> {
  const admin = createSupabaseAdminClient();

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, display_name, reminder_channel, telegram_username')
    .eq('daily_reminder', true);

  if (error) throw error;

  const list = (profiles ?? []) as ProfileForReminder[];
  const result: ReminderRunResult = {
    candidates: list.length,
    emailSent: 0,
    telegramSent: 0,
    emailSkipped: 0,
    telegramSkipped: 0,
    failures: 0,
  };
  if (list.length === 0) return result;

  // Берём email-адреса из auth.users одним вызовом
  // (limit 1000 достаточно на первое время; пагинацию добавим при росте).
  const { data: usersData } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const emailById = new Map<string, string>();
  for (const u of (usersData?.users ?? []) as AuthUser[]) {
    if (u.email) emailById.set(u.id, u.email);
  }

  for (const p of list) {
    try {
      if (p.reminder_channel === 'email') {
        const email = emailById.get(p.id);
        if (!email) {
          result.emailSkipped += 1;
          continue;
        }
        const { text, html } = bodyFor(p.display_name);
        const ok = await sendEmail({ to: email, subject: SUBJECT, text, html });
        ok ? (result.emailSent += 1) : (result.emailSkipped += 1);
      } else if (p.reminder_channel === 'telegram') {
        if (!p.telegram_username) {
          result.telegramSkipped += 1;
          continue;
        }
        const { text } = bodyFor(p.display_name);
        const ok = await sendTelegram({ username: p.telegram_username, text });
        ok ? (result.telegramSent += 1) : (result.telegramSkipped += 1);
      }
    } catch {
      result.failures += 1;
    }
  }

  return result;
}
