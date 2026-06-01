import { NextResponse, type NextRequest } from 'next/server';
import { runDailyReminders } from '@/lib/notifications/reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/daily-reminders
 *
 * Запускается Vercel Cron (см. vercel.json). Защищён заголовком
 * `Authorization: Bearer ${CRON_SECRET}` — Vercel передаёт этот заголовок
 * автоматически, если CRON_SECRET выставлен в Environment Variables.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDailyReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'error' },
      { status: 500 },
    );
  }
}

// GET — для ручной проверки руками админом (тоже требует CRON_SECRET)
export const GET = POST;
