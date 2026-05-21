import type { Metadata } from 'next';
import Link from 'next/link';
import { PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Добавить книгу вручную' };

export default function NewBookPage() {
  return (
    <div className="container flex min-h-[55vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <PencilLine className="size-10 text-muted-foreground/50" aria-hidden="true" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Добавить книгу вручную</h1>
        <p className="text-muted-foreground">
          Если книги нет в каталогах, вы сможете завести её сами. Эта форма
          появится в ближайшем обновлении вместе с подключением базы данных.
        </p>
      </div>
      <Button variant="outline" asChild>
        <Link href="/search">Вернуться к поиску</Link>
      </Button>
    </div>
  );
}
