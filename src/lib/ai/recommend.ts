'use server';

import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { searchGoogleBooks } from '@/lib/books/google';
import { encodeBookRef } from '@/lib/books/ref';

export interface RecommendationResult {
  ok: boolean;
  error?: string;
  /** Если не выполнены требования, поднимаем подсказку. */
  needs?: 'email' | 'genres' | 'api-key';
  title?: string;
  author?: string;
  reasoning?: string;
  coverUrl?: string | null;
  bookRef?: string | null;
}

const MODEL = 'claude-haiku-4-5-20251001';

interface ProfilePrefs {
  favorite_genres: string[];
  display_name: string;
}

interface AuthUserMeta {
  email_confirmed_at?: string | null;
}

/**
 * AI-рекомендация книги.
 * Требования:
 *  - вошедший пользователь с подтверждённой почтой
 *  - в профиле выбрано ≥ 3 любимых жанра
 *  - на сервере задан ANTHROPIC_API_KEY
 *
 * Использует Anthropic Claude Haiku — дёшево, отличный русский,
 * JSON-режим. История прошлых предложений хранится в ai_recommendations,
 * чтобы «Подумать ещё» давало новую книгу.
 */
export async function recommendBook(): Promise<RecommendationResult> {
  const user = (await getCurrentUser()) as (AuthUserMeta & { id: string }) | null;
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };
  if (!user.email_confirmed_at) {
    return { ok: false, needs: 'email', error: 'Подтвердите email в настройках входа' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      needs: 'api-key',
      error: 'AI-рекомендации временно недоступны',
    };
  }

  const supabase = await createSupabaseServerClient();

  const [profileRes, alreadyRes, readRes, likedRes, popularRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('favorite_genres, display_name')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('ai_recommendations')
      .select('title, author')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('user_books')
      .select('books(title, authors)')
      .eq('user_id', user.id)
      .in('status', ['read', 'reading'])
      .limit(40),
    supabase
      .from('reactions')
      .select('target_id')
      .eq('user_id', user.id)
      .eq('target_type', 'review')
      .eq('kind', 'like'),
    supabase
      .from('books')
      .select('title, authors, ratings_count, ratings_sum')
      .order('shelves_count', { ascending: false })
      .limit(20),
  ]);

  const profile = profileRes.data as ProfilePrefs | null;
  if (!profile || (profile.favorite_genres ?? []).length < 3) {
    return {
      ok: false,
      needs: 'genres',
      error: 'Выберите минимум 3 любимых жанра в профиле',
    };
  }

  const alreadySuggested = ((alreadyRes.data ?? []) as { title: string; author: string }[])
    .map((r) => `«${r.title}» — ${r.author}`);

  const readList = ((readRes.data ?? []) as unknown as {
    books: { title: string; authors: string } | null;
  }[])
    .map((r) => r.books)
    .filter((b): b is { title: string; authors: string } => Boolean(b))
    .map((b) => `«${b.title}» — ${b.authors}`)
    .slice(0, 30);

  const popular = ((popularRes.data ?? []) as { title: string; authors: string }[])
    .map((b) => `«${b.title}» — ${b.authors}`)
    .slice(0, 15);

  const prompt = buildPrompt({
    name: profile.display_name,
    genres: profile.favorite_genres,
    alreadySuggested,
    readList,
    likedCount: likedRes.data?.length ?? 0,
    popular,
  });

  const anthropic = new Anthropic({ apiKey });
  let parsed: { title: string; author: string; reasoning: string } | null = null;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      temperature: 0.9,
      system:
        'Ты помогаешь читателям выбирать книги. Отвечаешь СТРОГО валидным JSON, без префиксов и пояснений.',
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { text: string }).text)
      .join('');
    parsed = extractJson(text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка AI' };
  }
  if (!parsed || !parsed.title || !parsed.author) {
    return { ok: false, error: 'Не удалось разобрать ответ модели' };
  }

  // Достаём обложку через Google Books
  let coverUrl: string | null = null;
  let bookRef: string | null = null;
  try {
    const found = await searchGoogleBooks(`${parsed.title} ${parsed.author}`, {
      limit: 1,
    });
    if (found[0]) {
      coverUrl = found[0].coverUrl;
      bookRef = encodeBookRef(found[0].source, found[0].sourceId);
    }
  } catch {
    // не критично — карточка покажется без обложки
  }

  // Сохраняем историю, чтобы не повторяться
  await supabase.from('ai_recommendations').insert({
    user_id: user.id,
    title: parsed.title,
    author: parsed.author,
    reasoning: parsed.reasoning,
    cover_url: coverUrl,
    book_ref: bookRef,
  });

  return {
    ok: true,
    title: parsed.title,
    author: parsed.author,
    reasoning: parsed.reasoning,
    coverUrl,
    bookRef,
  };
}

function buildPrompt(input: {
  name: string;
  genres: string[];
  alreadySuggested: string[];
  readList: string[];
  likedCount: number;
  popular: string[];
}): string {
  return [
    `Порекомендуй ОДНУ книгу пользователю ${input.name}.`,
    '',
    `Его любимые жанры: ${input.genres.join(', ')}.`,
    input.readList.length > 0
      ? `Он уже читал или сейчас читает: ${input.readList.join('; ')}.`
      : '',
    input.likedCount > 0
      ? `Он лайкнул ${input.likedCount} отзыв(а/ов) других читателей.`
      : '',
    input.popular.length > 0
      ? `На «Книжной полке» сейчас популярно: ${input.popular.join('; ')}.`
      : '',
    input.alreadySuggested.length > 0
      ? `НЕ предлагай эти книги (уже рекомендовал): ${input.alreadySuggested.join('; ')}.`
      : '',
    'Также не предлагай те, что в списке прочитанных.',
    '',
    'Подбери настоящую, существующую книгу, подходящую под вкусы пользователя.',
    'Реальный автор, реально изданная книга.',
    'Это может быть классика или современный автор, на русском или в переводе на русский.',
    '',
    'Ответь СТРОГО в формате JSON:',
    '{',
    '  "title": "название книги на русском",',
    '  "author": "имя автора на русском",',
    '  "reasoning": "1-2 предложения: чем книга подходит этому читателю, обращайся к нему на «вы», без эмодзи"',
    '}',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Аккуратно достаёт JSON-объект из текстового ответа модели. */
function extractJson(
  text: string,
): { title: string; author: string; reasoning: string } | null {
  const trimmed = text.trim();
  // прямой JSON
  try {
    return JSON.parse(trimmed);
  } catch {}
  // ищем первый '{' и последний '}'
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {}
  }
  return null;
}
