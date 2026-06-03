import { createSupabaseServerClient } from '@/lib/supabase/server';

export type ArticleKind = 'editorial' | 'review' | 'other';
export type ArticleStatus = 'draft' | 'published';

export interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  bodyMd: string;
  coverUrl: string | null;
  kind: ArticleKind;
  status: ArticleStatus;
  publishedAt: string | null;
  relatedBookRef: string | null;
  viewsCount: number;
  commentsCount: number;
  likesCount: number;
  authorName: string | null;
  authorUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

const ARTICLE_SELECT =
  'id, slug, title, excerpt, body_md, cover_url, kind, status, published_at, ' +
  'related_book_ref, views_count, comments_count, likes_count, created_at, updated_at, ' +
  'profiles(display_name, username)';

interface ArticleJoin {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  cover_url: string | null;
  kind: ArticleKind;
  status: ArticleStatus;
  published_at: string | null;
  related_book_ref: string | null;
  views_count: number;
  comments_count: number;
  likes_count: number;
  created_at: string;
  updated_at: string;
  profiles: { display_name: string; username: string } | null;
}

function toArticle(r: ArticleJoin): ArticleRow {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    bodyMd: r.body_md,
    coverUrl: r.cover_url,
    kind: r.kind,
    status: r.status,
    publishedAt: r.published_at,
    relatedBookRef: r.related_book_ref,
    viewsCount: r.views_count,
    commentsCount: r.comments_count,
    likesCount: r.likes_count,
    authorName: r.profiles?.display_name ?? null,
    authorUsername: r.profiles?.username ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Список опубликованных статей (для /blog). */
export async function getPublishedArticles(): Promise<ArticleRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('articles')
    .select(ARTICLE_SELECT)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);
  return ((data ?? []) as unknown as ArticleJoin[]).map(toArticle);
}

/** Все статьи (для админа). */
export async function getAllArticles(): Promise<ArticleRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('articles')
    .select(ARTICLE_SELECT)
    .order('updated_at', { ascending: false });
  return ((data ?? []) as unknown as ArticleJoin[]).map(toArticle);
}

/** Статья по slug. */
export async function getArticleBySlug(slug: string): Promise<ArticleRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('articles')
    .select(ARTICLE_SELECT)
    .eq('slug', slug)
    .maybeSingle();
  return data ? toArticle(data as unknown as ArticleJoin) : null;
}

/** Статья по id (для редактирования в админке). */
export async function getArticleById(id: string): Promise<ArticleRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('articles')
    .select(ARTICLE_SELECT)
    .eq('id', id)
    .maybeSingle();
  return data ? toArticle(data as unknown as ArticleJoin) : null;
}
