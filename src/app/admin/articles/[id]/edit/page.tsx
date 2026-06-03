import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/admin/auth';
import { getArticleById } from '@/lib/articles/queries';
import { ArticleEditor } from '@/components/admin/article-editor';

export const metadata: Metadata = { title: 'Редактирование статьи' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditArticlePage({ params }: PageProps) {
  const admin = await getAdminContext();
  if (!admin) redirect('/');

  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) notFound();

  return (
    <div className="container max-w-3xl space-y-5 py-6">
      <header>
        <Link
          href="/admin/articles"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← к списку статей
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{article.title}</h1>
      </header>

      <ArticleEditor initial={article} />
    </div>
  );
}
