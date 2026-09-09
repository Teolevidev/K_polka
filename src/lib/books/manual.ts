'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server';
import { cleanIsbn, isValidIsbn10, isValidIsbn13, isbn10to13 } from './isbn';
import { encodeBookRef } from './ref';

/**
 * Заведение книги вручную.
 *
 * Внешние каталоги плохо знают русскую литературу: по «Василь Быков»
 * Google отдаёт только литературоведение о нём, а поиск по полю автора
 * (inauthor:) не находит ничего вовсе. OpenLibrary про него тоже молчит.
 * Поэтому книга, заведённая участником, - не запасной путь, а основной
 * способ наполнить каталог тем, что клуб реально читает.
 *
 * Добавленная книга сразу становится находимой: поиск ходит в наш
 * каталог наравне с внешними источниками (см. lib/books/local.ts).
 */

export interface ManualBookInput {
  title: string;
  authors: string;
  isbn: string;
  publishedYear: string;
  pageCount: string;
  description: string;
  coverUrl: string;
}

export interface ManualBookResult {
  ok: boolean;
  error?: string;
  /** Ссылка на созданную книгу для перехода на её страницу. */
  ref?: string;
}

const MAX_TITLE = 300;
const MAX_AUTHORS = 300;
const MAX_DESCRIPTION = 5000;

/** Год, дальше которого издание считаем опечаткой. */
const MAX_YEAR = new Date().getFullYear() + 1;

/**
 * Приводит ISBN к каноничному ISBN-13.
 * Возвращает null, если поле пустое, и строку ошибки, если код неверный.
 */
function normalizeIsbn(raw: string): { isbn13: string | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { isbn13: null };

  const cleaned = cleanIsbn(trimmed);
  if (isValidIsbn13(cleaned)) return { isbn13: cleaned };
  if (isValidIsbn10(cleaned)) return { isbn13: isbn10to13(cleaned) };

  return {
    isbn13: null,
    error: 'ISBN не похож на настоящий. Проверьте цифры или оставьте поле пустым.',
  };
}

/** Разбирает необязательное число в заданных границах. */
function parseNumber(
  raw: string,
  { min, max, label }: { min: number; max: number; label: string },
): { value: number | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null };

  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < min || n > max) {
    return { value: null, error: `${label}: ожидается число от ${min} до ${max}.` };
  }
  return { value: n };
}

export async function createBookManually(
  input: ManualBookInput,
): Promise<ManualBookResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Нужно войти в аккаунт' };

  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Без названия книгу не найти. Заполните его.' };
  if (title.length > MAX_TITLE) {
    return { ok: false, error: `Название длиннее ${MAX_TITLE} символов.` };
  }

  const authors = input.authors.trim().slice(0, MAX_AUTHORS);

  const { isbn13, error: isbnError } = normalizeIsbn(input.isbn);
  if (isbnError) return { ok: false, error: isbnError };

  const year = parseNumber(input.publishedYear, {
    min: 1400,
    max: MAX_YEAR,
    label: 'Год издания',
  });
  if (year.error) return { ok: false, error: year.error };

  const pages = parseNumber(input.pageCount, {
    min: 1,
    max: 20000,
    label: 'Число страниц',
  });
  if (pages.error) return { ok: false, error: pages.error };

  const coverUrl = input.coverUrl.trim();
  if (coverUrl && !/^https:\/\/\S+$/i.test(coverUrl)) {
    return { ok: false, error: 'Ссылка на обложку должна начинаться с https://' };
  }

  const supabase = await createSupabaseServerClient();

  try {
    // Дубликат по ISBN: если книга уже заведена, ведём на неё, а не
    // плодим вторую запись.
    if (isbn13) {
      const { data: existing } = await supabase
        .from('books')
        .select('id')
        .eq('isbn_13', isbn13)
        .maybeSingle();
      if (existing?.id) {
        return { ok: true, ref: encodeBookRef('local', existing.id as string) };
      }
    }

    const { data: created, error } = await supabase
      .from('books')
      .insert({
        isbn_13: isbn13,
        title,
        authors,
        description: input.description.trim().slice(0, MAX_DESCRIPTION) || null,
        cover_url: coverUrl || null,
        page_count: pages.value,
        published_date: year.value ? `${year.value}-01-01` : null,
        language: 'ru',
        media_type: 'book',
        data_sources: ['manual'],
        fetched_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !created) {
      throw new Error(error?.message ?? 'не удалось сохранить');
    }

    revalidatePath('/search');
    return { ok: true, ref: encodeBookRef('local', created.id as string) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Не удалось сохранить книгу',
    };
  }
}
