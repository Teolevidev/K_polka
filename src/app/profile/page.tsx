import type { Metadata } from 'next';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
import { SignInPrompt } from '@/components/layout/sign-in-prompt';
import { StatsDashboard } from '@/components/profile/stats-dashboard';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { emptyStats } from '@/lib/stats';

export const metadata: Metadata = { title: 'Профиль' };

export default async function ProfilePage() {
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;

  if (!user) {
    return (
      <SignInPrompt
        title="Профиль"
        description="Войдите, чтобы видеть статистику чтения, серии дней и прогресс по цели на год."
        next="/profile"
      />
    );
  }

  // Фаза 1: реальные числа подключаются вместе с запросами к user_books.
  const stats = emptyStats();
  const displayName = user.email?.split('@')[0] ?? 'Читатель';

  return (
    <div className="container space-y-6 py-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{displayName}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <SignOutButton />
      </div>

      <StatsDashboard stats={stats} />
    </div>
  );
}
