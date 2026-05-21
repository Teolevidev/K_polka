import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  /** compact — только графический знак; full — знак + wordmark. */
  variant?: 'full' | 'compact';
  className?: string;
}

/**
 * Логотип «Книжная полка».
 * Знак — три книжных корешка на полке. Wordmark — серифный шрифт.
 */
export function Logo({ variant = 'full', className }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn('inline-flex items-center gap-2.5 group', className)}
      aria-label="Книжная полка — на главную"
    >
      <LogoMark />
      {variant === 'full' && (
        <span className="font-serif text-lg font-semibold leading-none tracking-tight">
          Книжная{' '}
          <span className="text-primary">полка</span>
        </span>
      )}
    </Link>
  );
}

/** Графический знак: три корешка книг на полке. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('h-7 w-7 shrink-0', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* корешки книг */}
      <rect x="6" y="6" width="5" height="18" rx="1" className="fill-primary" />
      <rect
        x="12.5"
        y="9"
        width="5"
        height="15"
        rx="1"
        className="fill-accent"
      />
      <rect
        x="19"
        y="6.5"
        width="5"
        height="17.5"
        rx="1"
        className="fill-foreground"
      />
      {/* полка */}
      <rect
        x="4"
        y="24.5"
        width="24"
        height="2.6"
        rx="1.3"
        className="fill-foreground"
      />
    </svg>
  );
}
