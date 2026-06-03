import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PenLine, Plus, Eye } from 'lucide-react';
import { getAdminContext } from '@/lib/admin/auth';
import { getAllArticles } from '@/lib/articles/queries';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Статьи' };

export default async function AdminArticlesPage() {
  const admin = await getAdminContext();
  if (!admin) redirect('/');

  const articles = await getAllArticles();

  return (
    <div className="container max-w-3xl space-y-5 py-6">
      <header className="flex items-center gap-3">
        <PenLine className="size-6 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-semibold">Статьи</h1>
        <Button asChild className="ml-auto">
          <Link href="/admin/articles/new">
            <Plus className="size-4" />
            Новая статья
          </Link>
        </Button>
      </header>

      <nav className="flex gap-3 text-sm">
        <Link href="/admin" className="text-primary hover:underline">
          ← Модерация
        </Link>
        <Link href="/admin/editorial" className="text-primary hover:underline">
          Выбор администратора
        </Link>
        <Link href="/admin/polls" className="text-primary hover:underline">
          Голосовалки
        </Link>
      </nav>

      {articles.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Статей пока нет. Создайте первую — она появится в /blog после публикации.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {articles.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/articles/${a.id}/edit`}
                  className="font-medium hover:underline"
                >
                  {a.title}
                </Link>
                <p className="text-xs text-muted-foreground">/{a.slug}</p>
              </div>
              {a.status === 'published' ? (
                <Badge variant="default">
                  <Eye className="mr-1 size-3" /> Опубликована
                </Badge>
              ) : (
                <Badge variant="outline">Черновик</Badge>
              )}
              <Link
                href={`/admin/articles/${a.id}/edit`}
                className="text-sm font-medium text-primary hover:underline"
              >
                редактировать
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
