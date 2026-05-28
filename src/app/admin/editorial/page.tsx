import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookMarked } from 'lucide-react';
import { getAdminContext } from '@/lib/admin/auth';
import { getAllEditorialPicks } from '@/lib/editorial/queries';
import { mondayOf } from '@/lib/editorial/week';
import { EditorialMarker } from '@/components/admin/editorial-marker';
import { EditorialList } from '@/components/admin/editorial-list';

export const metadata: Metadata = { title: 'Выбор администратора' };

export default async function EditorialAdminPage() {
  const admin = await getAdminContext();
  if (!admin) redirect('/');

  const picks = await getAllEditorialPicks();
  const currentWeek = mondayOf();

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      <header className="flex items-center gap-3">
        <BookMarked className="size-6 text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold">Выбор администратора</h1>
          <p className="text-sm text-muted-foreground">
            Управление пятёркой книг на главной. Ротация раз в неделю.
          </p>
        </div>
        <Link
          href="/admin"
          className="ml-auto text-sm font-medium text-primary hover:underline"
        >
          ← к модерации
        </Link>
      </header>

      <EditorialMarker />
      <EditorialList picks={picks} currentWeekMonday={currentWeek} />
    </div>
  );
}
