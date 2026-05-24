import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
import { getProfile } from '@/lib/profile/queries';
import { getReadingStats } from '@/lib/shelf/queries';
import { SignInPrompt } from '@/components/layout/sign-in-prompt';
import { StatsDashboard } from '@/components/profile/stats-dashboard';
import { GoalSetter } from '@/components/profile/goal-setter';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Профиль' };

export default async function ProfilePage() {
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;

  if (!user) {
    return (
      <SignInPrompt
        title="Профиль"
        description="Войдите, чтобы видеть статистику чтения, серии дней и прогресс по цели."
        next="/profile"
      />
    );
  }

  const [profile, stats] = await Promise.all([
    getProfile(user.id),
    getReadingStats(user.id),
  ]);

  const displayName = profile?.display_name ?? user.email?.split('@')[0] ?? 'Читатель';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      {/* Шапка профиля */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold leading-tight">{displayName}</h1>
          {profile?.username && (
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
          )}
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/profile/edit">
              <Pencil className="size-4" />
              Редактировать
            </Link>
          </Button>
          <SignOutButton />
        </div>
      </div>

      {profile?.bio && (
        <p className="text-sm leading-relaxed text-foreground/90">{profile.bio}</p>
      )}

      <StatsDashboard stats={stats} />

      {!stats.goalTarget && (
        <GoalSetter year={stats.goalYear} currentTarget={null} />
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/library">Моя полка</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/search">Найти книгу</Link>
        </Button>
        {stats.goalTarget && (
          <Button variant="ghost" asChild>
            <Link href="/profile/edit">Изменить настройки</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
