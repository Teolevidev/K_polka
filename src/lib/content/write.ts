import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { encodeBookRef } from '@/lib/books/ref';
import { ensureEditorialAuthor } from './editorial-account';
import { applyTextRules, checkArticleDraft, slugify, SLUG_RE } from './guards';
import {
  MAX_WORDS,
  MIN_LONGREAD_WORDS,
  MIN_REVIEW_WORDS,
  SYSTEM_PROMPT,
  longreadPrompt,
  reviewPrompt,
  roundupPrompt,
  type BookFacts,
} from './prompts';
import type {
  ContentJobResult,
  LongreadPayload,
  ReviewPayload,
  RoundupPayload,
} from './types';

/**
 * Тексты: рецензии, лонгриды, подборки.
 *
 * Все они устроены одинаково: собрать факты из своей же базы, попросить
 * модель, причесать по правилам проекта, проверить и положить
 * ЧЕРНОВИКОМ. Черновик - не режим первых недель, а постоянный порядок:
 * ни одна строка не появляется на сайте без человека.
 */

/**
 * Модели.
 *
 * Рецензия и подборка - работа на полторы тысячи знаков по готовым
 * фактам, с ней справляется Haiku, и она уже используется в
 * рекомендациях. Лонгрид - другой жанр: там нужна мысль, а не пересказ,
 * и разница между моделями видна сразу.
 */
const MODEL_SHORT = 'claude-haiku-4-5-20251001';
const MODEL_LONG = 'claude-sonnet-5';

interface DraftFromModel {
  title: string;
  excerpt: string;
  bodyMd: string;
}

/** Ответ модели: один JSON, возможно в markdown-ограждении. */
function extractJson(text: string): DraftFromModel | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  const candidates = [trimmed];
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<DraftFromModel>;
      if (typeof parsed.title === 'string' && typeof parsed.bodyMd === 'string') {
        return {
          title: parsed.title,
          excerpt: typeof parsed.excerpt === 'string' ? parsed.excerpt : '',
          bodyMd: parsed.bodyMd,
        };
      }
    } catch {
      // пробуем следующий вариант
    }
  }
  return null;
}

/** Один вызов модели. */
async function askModel(
  prompt: string,
  options: { model: string; maxTokens: number },
): Promise<DraftFromModel> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Не задан ANTHROPIC_API_KEY');

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: options.model,
    max_tokens: options.maxTokens,
    temperature: 0.8,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { text: string }).text)
    .join('');

  const parsed = extractJson(text);
  if (!parsed) {
    throw new Error(`Ответ модели не разобрался как JSON: ${text.slice(0, 200)}`);
  }
  return parsed;
}

/** Строка каталога в том виде, в каком она нужна промпту. */
const BOOK_FACT_SELECT =
  'id, title, authors, description, published_date, page_count, language, google_books_id, openlibrary_work_id, isbn_13';

interface BookRow {
  id: string;
  title: string;
  authors: string | null;
  description: string | null;
  published_date: string | null;
  page_count: number | null;
  language: string | null;
  google_books_id: string | null;
  openlibrary_work_id: string | null;
}

function rowToFacts(row: BookRow): BookFacts {
  return {
    title: row.title,
    authors: row.authors ? row.authors.split(', ').filter(Boolean) : [],
    description: row.description,
    publishedYear: row.published_date
      ? Number(row.published_date.slice(0, 4)) || null
      : null,
    // Издательство каталог пока не хранит - и лучше пусто, чем догадка.
    publisher: null,
    pageCount: row.page_count,
    language: row.language,
  };
}

/** Ссылка на страницу книги для поля related_book_ref. */
function bookRefOf(row: BookRow): string | null {
  if (row.google_books_id) return encodeBookRef('google', row.google_books_id);
  if (row.openlibrary_work_id) {
    return encodeBookRef('openlibrary', row.openlibrary_work_id);
  }
  return encodeBookRef('local', row.id);
}

async function loadBook(
  supabase: SupabaseClient,
  bookId: string,
): Promise<BookRow> {
  const { data } = await supabase
    .from('books')
    .select(BOOK_FACT_SELECT)
    .eq('id', bookId)
    .maybeSingle();
  if (!data) throw new Error(`Книги ${bookId} нет в каталоге`);
  return data as unknown as BookRow;
}

/**
 * Свободный адрес статьи.
 *
 * Slug выводится из заголовка, а заголовки повторяются: два обзора
 * одной книги дадут один и тот же адрес, и второй не сохранится.
 * Поэтому при занятом адресе добавляется номер.
 */
async function freeSlug(
  supabase: SupabaseClient,
  title: string,
): Promise<string> {
  const base = slugify(title) || 'statya';
  for (let i = 0; i < 20; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (!SLUG_RE.test(candidate)) continue;
    const { data } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

interface SaveDraftInput {
  draft: DraftFromModel;
  kind: 'editorial' | 'review';
  relatedBookRef: string | null;
  book: { title: string; authors: string[] } | null;
  minBodyLength: number;
  minWords: number;
}

/**
 * Причесывает, проверяет и сохраняет черновик.
 *
 * Правила текста применяются молча - это замена двух символов, а не
 * повод возвращать статью на переписывание. А вот содержательные
 * проверки (назван ли автор книги, не заговорила ли модель о себе)
 * роняют задание: такой текст чинится не правкой, а новым прогоном.
 */
async function saveDraft(
  supabase: SupabaseClient,
  input: SaveDraftInput,
): Promise<ContentJobResult> {
  const author = await ensureEditorialAuthor(supabase);

  const title = applyTextRules(input.draft.title);
  const excerpt = applyTextRules(input.draft.excerpt);
  const bodyMd = applyTextRules(input.draft.bodyMd);

  const check = checkArticleDraft({
    title,
    excerpt,
    bodyMd,
    book: input.book,
    minBodyLength: input.minBodyLength,
    minWords: input.minWords,
    maxWords: MAX_WORDS,
  });
  if (check.errors.length > 0) {
    throw new Error(`Черновик не прошел проверку: ${check.errors.join('; ')}`);
  }

  const slug = await freeSlug(supabase, title);

  const { data, error } = await supabase
    .from('articles')
    .insert({
      slug,
      title,
      excerpt: excerpt || null,
      body_md: bodyMd,
      kind: input.kind,
      author_id: author.id,
      related_book_ref: input.relatedBookRef,
      // Всегда черновик. Публикует человек в /admin/articles.
      status: 'draft',
      published_at: null,
    })
    .select('id, slug')
    .single();

  if (error || !data) {
    throw new Error(`Не удалось сохранить черновик: ${error?.message ?? ''}`);
  }

  return {
    summary: `Черновик «${title}» готов к вычитке`,
    articleId: data.id as string,
    slug: data.slug as string,
    warnings: check.warnings,
  };
}

/** Рецензия на книгу каталога. */
export async function runReview(
  payload: ReviewPayload,
  client?: SupabaseClient,
): Promise<ContentJobResult> {
  const supabase = client ?? createSupabaseAdminClient();
  if (!payload.bookId) throw new Error('В задании не указана книга (bookId)');

  const row = await loadBook(supabase, payload.bookId);
  const facts = rowToFacts(row);

  const draft = await askModel(reviewPrompt(facts, payload), {
    model: MODEL_SHORT,
    maxTokens: 2500,
  });

  return saveDraft(supabase, {
    draft,
    kind: 'review',
    relatedBookRef: bookRefOf(row),
    book: { title: facts.title, authors: facts.authors },
    minBodyLength: 1200,
    minWords: MIN_REVIEW_WORDS,
  });
}

/** Лонгрид по теме. */
export async function runLongread(
  payload: LongreadPayload,
  client?: SupabaseClient,
): Promise<ContentJobResult> {
  const supabase = client ?? createSupabaseAdminClient();
  if (!payload.topic?.trim()) throw new Error('В задании не указана тема');

  const ids = payload.bookIds ?? [];
  const rows: BookRow[] = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from('books')
      .select(BOOK_FACT_SELECT)
      .in('id', ids);
    rows.push(...((data ?? []) as unknown as BookRow[]));
  }

  const draft = await askModel(longreadPrompt(payload, rows.map(rowToFacts)), {
    model: MODEL_LONG,
    maxTokens: 3000,
  });

  return saveDraft(supabase, {
    draft,
    kind: 'editorial',
    relatedBookRef: rows[0] ? bookRefOf(rows[0]) : null,
    // У лонгрида одной книги нет, и проверять «назван ли автор» не по чему.
    book: null,
    minBodyLength: 2000,
    minWords: MIN_LONGREAD_WORDS,
  });
}

/** Подборка из книг каталога. */
export async function runRoundup(
  payload: RoundupPayload,
  client?: SupabaseClient,
): Promise<ContentJobResult> {
  const supabase = client ?? createSupabaseAdminClient();
  if (!payload.theme?.trim()) throw new Error('В задании не указана тема подборки');

  // Берем заметно больше, чем нужно в подборке: выбирать из каталога
  // должна модель, а не порядок строк в таблице.
  const { data } = await supabase
    .from('books')
    .select(BOOK_FACT_SELECT)
    .order('created_at', { ascending: false })
    .limit(60);

  const rows = (data ?? []) as unknown as BookRow[];
  if (rows.length < 3) {
    throw new Error(
      `В каталоге ${rows.length} книг - для подборки мало. Сначала заведите книги.`,
    );
  }

  const draft = await askModel(roundupPrompt(payload, rows.map(rowToFacts)), {
    model: MODEL_SHORT,
    maxTokens: 3000,
  });

  return saveDraft(supabase, {
    draft,
    kind: 'editorial',
    relatedBookRef: null,
    book: null,
    minBodyLength: 1200,
    minWords: MIN_REVIEW_WORDS,
  });
}
