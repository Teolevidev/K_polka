import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ManualBookForm } from '@/components/book/manual-book-form';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Добавить книгу вручную' };

interface NewBookPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function NewBookPage({ searchParams }: NewBookPageProps) {
  const { q } = await searchParams;
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;

  return (
    <div className="container max-w-2xl space-y-6 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Добавить книгу вручную</h1>
        <p className="text-muted-foreground">
          Внешние каталоги плохо знают русскую литературу. Если книги там нет —
          заведите её сами: она попадёт в общий каталог клуба и станет
          находиться в поиске у всех.
        </p>
        {q && (
          <p className="text-sm text-muted-foreground">
            Вы искали <span className="font-medium text-foreground">«{q}»</span> и
            ничего не нашли.
          </p>
        )}
      </div>

      {!user ? (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/50 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="space-y-2">
            <p className="font-medium">Нужно войти</p>
            <p className="text-muted-foreground">
              Книги в каталог добавляют участники клуба, поэтому нужен вход.
            </p>
            <Button size="sm" asChild>
              <Link href="/signin?next=/book/new">Войти</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ManualBookForm />
      )}

      <p className="text-sm text-muted-foreground">
        <Link href="/search" className="underline underline-offset-4">
          Вернуться к поиску
        </Link>
      </p>
    </div>
  );
}
