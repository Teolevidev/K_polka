'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/auth';

export type PollStatus = 'open' | 'closed';

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface PollData {
  id: string;
  question: string;
  status: PollStatus;
  endsAt: string | null;
  createdAt: string;
  options: PollOption[];
  totalVotes: number;
  myOptionId: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Активная (последняя открытая) голосовалка с тиражом. */
export async function getActivePoll(): Promise<PollData | null> {
  const supabase = await createSupabaseServerClient();
  const { data: poll } = await supabase
    .from('polls')
    .select('id, question, status, ends_at, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!poll) return null;

  return buildPoll(poll.id, {
    id: poll.id,
    question: poll.question,
    status: poll.status as PollStatus,
    ends_at: poll.ends_at,
    created_at: poll.created_at,
  });
}

/** Голосовалка по id (для админ-страницы). */
export async function getPollById(id: string): Promise<PollData | null> {
  const supabase = await createSupabaseServerClient();
  const { data: poll } = await supabase
    .from('polls')
    .select('id, question, status, ends_at, created_at')
    .eq('id', id)
    .maybeSingle();
  if (!poll) return null;
  return buildPoll(poll.id, poll);
}

async function buildPoll(
  pollId: string,
  poll: {
    id: string;
    question: string;
    status: string;
    ends_at: string | null;
    created_at: string;
  },
): Promise<PollData> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  const [optionsRes, votesRes, myVoteRes] = await Promise.all([
    supabase
      .from('poll_options')
      .select('id, label')
      .eq('poll_id', pollId)
      .order('position'),
    supabase.from('poll_votes').select('option_id').eq('poll_id', pollId),
    user
      ? supabase
          .from('poll_votes')
          .select('option_id')
          .eq('poll_id', pollId)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const options = (optionsRes.data ?? []) as { id: string; label: string }[];
  const votes = (votesRes.data ?? []) as { option_id: string }[];
  const tally = new Map<string, number>();
  for (const v of votes) tally.set(v.option_id, (tally.get(v.option_id) ?? 0) + 1);

  return {
    id: poll.id,
    question: poll.question,
    status: poll.status as PollStatus,
    endsAt: poll.ends_at,
    createdAt: poll.created_at,
    options: options.map((o) => ({
      id: o.id,
      label: o.label,
      votes: tally.get(o.id) ?? 0,
    })),
    totalVotes: votes.length,
    myOptionId: (myVoteRes.data as { option_id: string } | null)?.option_id ?? null,
  };
}

/** Голос за вариант. Если уже голосовал — меняет голос. */
export async function vote(pollId: string, optionId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти, чтобы голосовать' };

  const supabase = await createSupabaseServerClient();
  // poll должна быть открытой
  const { data: poll } = await supabase
    .from('polls')
    .select('status')
    .eq('id', pollId)
    .maybeSingle();
  if (!poll || poll.status !== 'open') {
    return { ok: false, error: 'Голосование закрыто' };
  }

  const { error } = await supabase.from('poll_votes').upsert(
    { poll_id: pollId, option_id: optionId, user_id: user.id },
    { onConflict: 'poll_id,user_id' },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Админ: создаёт голосовалку с вариантами. */
export async function createPoll(
  question: string,
  options: string[],
): Promise<ActionResult> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: 'Доступ только для администратора' };

  const q = question.trim();
  const opts = options.map((o) => o.trim()).filter((o) => o.length > 0);
  if (q.length < 5) return { ok: false, error: 'Вопрос слишком короткий' };
  if (opts.length < 2) return { ok: false, error: 'Минимум 2 варианта' };
  if (opts.length > 8) return { ok: false, error: 'Максимум 8 вариантов' };

  const supabase = await createSupabaseServerClient();
  const { data: poll, error } = await supabase
    .from('polls')
    .insert({ question: q, created_by: admin.userId })
    .select('id')
    .single();
  if (error || !poll) return { ok: false, error: error?.message ?? 'Ошибка' };

  const rows = opts.map((label, i) => ({
    poll_id: poll.id,
    label,
    position: i,
  }));
  const { error: optErr } = await supabase.from('poll_options').insert(rows);
  if (optErr) return { ok: false, error: optErr.message };

  revalidatePath('/admin/polls');
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Все голосовалки — для админ-страницы. */
export async function getAllPolls(): Promise<PollData[]> {
  const supabase = await createSupabaseServerClient();
  const { data: polls } = await supabase
    .from('polls')
    .select('id, question, status, ends_at, created_at')
    .order('created_at', { ascending: false });

  const list = (polls ?? []) as {
    id: string;
    question: string;
    status: string;
    ends_at: string | null;
    created_at: string;
  }[];

  return Promise.all(list.map((p) => buildPoll(p.id, p)));
}

/** Закрывает голосовалку. */
export async function closePoll(id: string): Promise<ActionResult> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: 'Доступ только для администратора' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('polls')
    .update({ status: 'closed' })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/polls');
  revalidatePath('/', 'layout');
  return { ok: true };
}
