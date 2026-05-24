import type { Metadata } from 'next';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
import { getUserShelfBooks } from '@/lib/shelf/queries';
import { SignInPrompt } from '@/components/layout/sign-in-prompt';
import { ShelfTabs } from '@/components/book/shelf-tabs';

export const metadata: Metadata = { title: 'Моя полка' };

export default async function LibraryPage() {
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;

  if (!user) {
    return (
      <SignInPrompt
        title="Моя полка"
        description="Войдите, чтобы вести полки «Читаю», «Прочитано» и «Хочу прочесть»."
        next="/library"
      />
    );
  }

  const books = await getUserShelfBooks(user.id);

  return (
    <div className="container space-y-5 py-6">
      <h1 className="text-2xl font-semibold">Моя полка</h1>
      <ShelfTabs books={books} />
    </div>
  );
}
