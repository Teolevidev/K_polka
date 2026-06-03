import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/admin/auth';
import { ArticleEditor } from '@/components/admin/article-editor';

export const metadata: Metadata = { title: 'Новая статья' };

export default async function NewArticlePage() {
  const admin = await getAdminContext();
  if (!admin) redirect('/');

  return (
    <div className="container max-w-3xl space-y-5 py-6">
      <header>
        <Link
          href="/admin/articles"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← к списку статей
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Новая статья</h1>
      </header>

      <ArticleEditor />
    </div>
  );
}
