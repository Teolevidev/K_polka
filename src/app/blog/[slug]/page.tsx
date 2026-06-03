import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
import { getArticleBySlug } from '@/lib/articles/queries';
import { getComments } from '@/lib/comments';
import { getReactionSummary } from '@/lib/reactions';
import { ReactionButtons } from '@/components/reactions/reaction-buttons';
import { CommentThread } from '@/components/comments/comment-thread';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const DATE_FMT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const KIND_LABEL: Record<string, string> = {
  editorial: 'Колонка редактора',
  review: 'Обзор',
  other: 'Заметка',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article || article.status !== 'published') {
    return { title: 'Статья не найдена' };
  }
  return {
    title: article.title,
    description: article.excerpt ?? undefined,
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const user = isSupabaseConfigured() ? await getCurrentUser() : null;

  // Черновики видит только админ (но статью админу мы и так показываем — RLS).
  // Если RLS вернул статью со status=draft пользователю без прав — это
  // означает, что он автор/админ; покажем с пометкой.
  const isDraft = article.status !== 'published';

  const [comments, reactions] = await Promise.all([
    getComments('article', article.id),
    getReactionSummary('article', article.id),
  ]);

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      <Link
        href="/blog"
        className="text-sm font-medium text-primary hover:underline"
      >
        ← все статьи
      </Link>

      {isDraft && (
        <div className="rounded-md border border-accent/50 bg-accent/10 px-3 py-2 text-sm">
          Черновик: видна только администратору
        </div>
      )}

      <article className="space-y-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="rounded-full bg-secondary px-2 py-0.5">
            {KIND_LABEL[article.kind] ?? article.kind}
          </span>
          {article.publishedAt && (
            <time>{DATE_FMT.format(new Date(article.publishedAt))}</time>
          )}
          {article.authorName && <span>· {article.authorName}</span>}
        </div>

        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          {article.title}
        </h1>
        {article.excerpt && (
          <p className="text-lg text-muted-foreground">{article.excerpt}</p>
        )}

        {article.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.coverUrl}
            alt=""
            className="w-full rounded-lg object-cover"
          />
        )}

        <div className="prose prose-neutral max-w-none whitespace-pre-line text-base leading-relaxed dark:prose-invert">
          {article.bodyMd}
        </div>

        {article.relatedBookRef && (
          <p className="text-sm">
            Связанная книга:{' '}
            <Link
              href={`/book/${article.relatedBookRef}`}
              className="font-medium text-primary hover:underline"
            >
              посмотреть на «Книжной полке»
            </Link>
          </p>
        )}

        <div className="flex items-center gap-3 border-y border-border py-3">
          <ReactionButtons
            targetType="article"
            targetId={article.id}
            isSignedIn={Boolean(user)}
            initial={reactions}
            signinHref={`/signin?next=/blog/${article.slug}`}
          />
        </div>
      </article>

      <CommentThread
        parentType="article"
        parentId={article.id}
        comments={comments}
        isSignedIn={Boolean(user)}
        signinHref={`/signin?next=/blog/${article.slug}`}
      />
    </div>
  );
}
