import { NextResponse, type NextRequest } from 'next/server';
import { runContentJobs } from '@/lib/content/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Тик контент-агента.
 *
 * Запускается Vercel Cron (см. vercel.json) и защищен тем же способом,
 * что рассылка напоминаний: `Authorization: Bearer ${CRON_SECRET}`.
 * Секрет здесь не формальность - за этим адресом стоят деньги за
 * обращения к модели, и открытый он превратится в чужой генератор
 * текстов за ваш счет.
 *
 * За один тик берется одно задание. Лонгрид - это минуты работы модели,
 * и класть в один запрос сразу несколько значит гарантированно быть
 * убитым по таймауту посреди записи. Очередь разгребается частыми
 * тиками, а не длинными.
 */

/** Сколько заданий за тик. Можно поднять параметром ?limit=. */
const DEFAULT_LIMIT = 1;

/**
 * Останавливаемся заранее. У функции на Vercel есть свой предел, и
 * упереться в него посреди задания хуже, чем недобрать: задание
 * останется в статусе running и его придется вынимать руками.
 */
const BUDGET_MS = 50_000;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const limitParam = Number(req.nextUrl.searchParams.get('limit'));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 10) : DEFAULT_LIMIT;

  try {
    const report = await runContentJobs({ limit, budgetMs: BUDGET_MS });
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'error' },
      { status: 500 },
    );
  }
}

// GET - для ручной проверки. Секрет требуется тот же самый.
export const GET = POST;
