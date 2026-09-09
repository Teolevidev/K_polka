import Link from 'next/link';
import { Suspense } from 'react';
import { Logo } from './logo';
import { SearchBar } from './search-bar';
import { ThemeToggle } from './theme-toggle';
import { Button } from '@/components/ui/button';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/auth';

const NAV_LINKS = [
  { href: '/blog', label: 'Блог' },
  { href: '/discover', label: 'Обзор' },
  { href: '/library', label: 'Моя полка' },
];

/**
 * Верхняя шапка: логотип слева, ссылки по центру, аккаунт справа.
 *
 * Минимальная и без рамки - в опорном стиле границу между шапкой и
 * первой лентой рисует смена цвета, а не хайрлайн. Липкость оставляем:
 * поиск должен быть под рукой на любой глубине страницы.
 */
export async function Header() {
  const signedIn = isSupabaseConfigured() ? Boolean(await getCurrentUser()) : false;
  const admin = signedIn ? await getAdminContext() : null;

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container flex h-16 items-center gap-4">
        <Logo />

        {/* Поиск — на десктопе в шапке */}
        <div className="hidden flex-1 justify-center md:flex">
          <Suspense fallback={<div className="h-10 w-full max-w-md" />}>
            <SearchBar className="max-w-md" />
          </Suspense>
        </div>

        <nav className="ml-auto flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="hidden px-3 text-sm font-medium underline-offset-4 hover:underline sm:inline-flex"
            >
              {label}
            </Link>
          ))}
          {admin && (
            <Link
              href="/admin"
              className="hidden px-3 text-sm font-medium underline-offset-4 hover:underline sm:inline-flex"
            >
              Админка
            </Link>
          )}
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
        <Suspense fallback={<div className="h-10 w-full" />}>
          <SearchBar />
        </Suspense>
      </div>
    </header>
  );
}
