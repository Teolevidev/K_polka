import type { Metadata } from 'next';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
import { getProfile, getGenres } from '@/lib/profile/queries';
import { SignInPrompt } from '@/components/layout/sign-in-prompt';
import { ProfileForm } from '@/components/profile/profile-form';

export const metadata: Metadata = { title: 'Редактирование профиля' };

export default async function ProfileEditPage() {
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;

  if (!user) {
    return (
      <SignInPrompt
        title="Редактирование профиля"
        description="Войдите, чтобы настроить свой профиль."
        next="/profile/edit"
      />
    );
  }

  const [profile, genres] = await Promise.all([getProfile(user.id), getGenres()]);

  if (!profile) {
    return (
      <div className="container py-10 text-center text-muted-foreground">
        Профиль не найден.
      </div>
    );
  }

  return (
    <div className="container max-w-xl space-y-5 py-6">
      <h1 className="text-2xl font-semibold">Редактирование профиля</h1>
      <ProfileForm profile={profile} genres={genres} email={user.email ?? ''} />
    </div>
  );
}
