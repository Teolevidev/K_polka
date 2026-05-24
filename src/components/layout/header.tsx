import Link from 'next/link';
import { Logo } from './logo';
import { SearchBar } from './search-bar';
import { ThemeToggle } from './theme-toggle';
import { Button } from '@/components/ui/button';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';

/** Верхняя шапка приложения. */
export async function Header() {
  const signedIn = isSupabaseConfigured() ? Boolean(await getCurrentUser()) : false;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center gap-4">
        <Logo />

        {/* Поиск — на десктопе в шапке */}
        <div className="hidden flex-1 justify-center md:flex">
          <SearchBar className="max-w-md" />
        </div>

        <nav className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/discover">Обзор</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/library">Моя полка</Link>
          </Button>
          <ThemeToggle />
          {signedIn ? (
            <Button size="sm" asChild>
              <Link href="/profile">Профиль</Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link href="/signin">Войти</Link>
            </Button>
          )}
        </nav>
      </div>

      {/* Поиск — на мобильном отдельной строкой */}
      <div className="container pb-3 md:hidden">
        <SearchBar />
      </div>
    </header>
  );
}
