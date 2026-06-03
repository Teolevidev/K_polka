import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Vote } from 'lucide-react';
import { getAdminContext } from '@/lib/admin/auth';
import { getAllPolls } from '@/lib/polls';
import { PollCreator } from '@/components/admin/poll-creator';

export const metadata: Metadata = { title: 'Голосовалки' };

export default async function AdminPollsPage() {
  const admin = await getAdminContext();
  if (!admin) redirect('/');

  const polls = await getAllPolls();

  return (
    <div className="container max-w-3xl space-y-5 py-6">
      <header className="flex items-center gap-3">
        <Vote className="size-6 text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold">Голосовалки</h1>
          <p className="text-sm text-muted-foreground">
            Активный (последний открытый) опрос показывается на главной.
          </p>
        </div>
        <Link
          href="/admin"
          className="ml-auto text-sm font-medium text-primary hover:underline"
        >
          ← к модерации
        </Link>
      </header>

      <PollCreator polls={polls} />
    </div>
  );
}
