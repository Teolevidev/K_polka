import { HomeHero } from '@/components/home/home-hero';
import { HomeMemberBlock } from '@/components/home/member-block';
import { BookRow } from '@/components/home/book-row';
import { showcaseSections } from '@/lib/books/showcase';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
import { getProfile } from '@/lib/profile/queries';
import { getReadingStats } from '@/lib/shelf/queries';
import { emptyStats } from '@/lib/stats';

export default async function HomePage() {
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;

  let userName: string | null = null;
  let stats = emptyStats();
  if (user) {
    const [profile, readingStats] = await Promise.all([
      getProfile(user.id),
      getReadingStats(user.id),
    ]);
    userName = profile?.display_name ?? user.email?.split('@')[0] ?? 'Читатель';
    stats = readingStats;
  }

  return (
    <div className="space-y-10 pb-8 pt-2">
      {/* Гостям — маркетинговый экран; участникам сразу персональный блок */}
      {!userName && <HomeHero />}

      {/* Персональный блок — максимально высоко, личные мотиваторы */}
      <HomeMemberBlock userName={userName} stats={stats} />

      <BookRow
        title="Популярное сейчас"
        subtitle="Что читают в «Книжной полке» на этой неделе"
        books={showcaseSections.popular}
        showAllHref="/discover"
        ranked
      />

      <BookRow
        title="Выбор администратора этой недели"
        subtitle="Пять книг, которые советует команда «Книжной полки»"
        books={showcaseSections.adminPicks}
        showAllHref="/discover"
      />
    </div>
  );
}
