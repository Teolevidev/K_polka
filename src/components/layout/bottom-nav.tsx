'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Library, User, Compass, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Нижняя навигация - только на мобильных устройствах.
 *
 * У гостя и участника здесь разные пункты. Раньше всем показывались
 * «Полка» и «Профиль»: гость тыкал в них и упирался в экран входа -
 * меню обещало то, чего у него нет. Теперь гостю предлагается то, что
 * ему доступно: обзор книг и вход.
 */
const MEMBER_ITEMS = [
  { href: '/', label: 'Главная', icon: Home, exact: true },
  { href: '/search', label: 'Поиск', icon: Search, exact: false },
  { href: '/library', label: 'Полка', icon: Library, exact: false },
  { href: '/profile', label: 'Профиль', icon: User, exact: false },
];

const GUEST_ITEMS = [
  { href: '/', label: 'Главная', icon: Home, exact: true },
  { href: '/search', label: 'Поиск', icon: Search, exact: false },
  { href: '/discover', label: 'Обзор', icon: Compass, exact: false },
  { href: '/signin', label: 'Войти', icon: LogIn, exact: false },
];

export function BottomNav({ signedIn = false }: { signedIn?: boolean }) {
  const pathname = usePathname();
  const items = signedIn ? MEMBER_ITEMS : GUEST_ITEMS;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
      <ul className="flex h-16 items-stretch">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-xs transition-colors',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
