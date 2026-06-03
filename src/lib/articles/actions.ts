'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/auth';
import type { ArticleKind, ArticleStatus } from './queries';

export interface ActionResult {
  ok: boolean;
  error?: string;
  slug?: string;
}

export interface ArticleInput {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMd: string;
  coverUrl: string;
  kind: ArticleKind;
  status: ArticleStatus;
  relatedBookRef: string;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}$/;

/** Создаёт или обновляет статью. Доступно только админу/модератору. */
export async function saveArticle(input: ArticleInput): Promise<ActionResult> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: 'Доступ только для администратора' };

  const slug = input.slug.trim().toLowerCase();
  const title = input.title.trim();
  const body = input.bodyMd.trim();

  if (!SLUG_RE.test(slug)) {
    return { ok: false, error: 'Slug: латиница, цифры, дефис (2–80 символов)' };
  }
  if (title.length < 2) return { ok: false, error: 'Заголовок слишком короткий' };
  if (body.length < 10) return { ok: false, error: 'Текст слишком короткий' };

  const supabase = await createSupabaseServerClient();
  const payload = {
    slug,
    title,
    excerpt: input.excerpt.trim() || null,
    body_md: body,
    cover_url: input.coverUrl.trim() || null,
    kind: input.kind,
    related_book_ref: input.relatedBookRef.trim() || null,
    status: input.status,
    published_at:
      input.status === 'published' ? new Date().toISOString() : null,
    author_id: admin.userId,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from('articles')
      .update(payload)
      .eq('id', input.id);
    if (error) {
      if (error.code === '23505') return { ok: false, error: 'Такой slug уже занят' };
      return { ok: false, error: error.message };
    }
  } else {
    const { error } = await supabase.from('articles').insert(payload);
    if (error) {
      if (error.code === '23505') return { ok: false, error: 'Такой slug уже занят' };
      return { ok: false, error: error.message };
    }
  }

  revalidatePath('/blog');
  revalidatePath(`/blog/${slug}`);
  revalidatePath('/admin/articles');
  return { ok: true, slug };
}

/** Удаляет статью. */
export async function deleteArticle(id: string): Promise<ActionResult> {
  const admin = await getAdminContext();
  if (!admin) return { ok: false, error: 'Доступ только для администратора' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('articles').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/blog');
  revalidatePath('/admin/articles');
  return { ok: true };
}
