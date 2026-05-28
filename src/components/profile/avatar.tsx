import { cn } from '@/lib/utils';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'size-8 text-sm',
  md: 'size-12 text-lg',
  lg: 'size-16 text-2xl',
};

/**
 * Аватар пользователя.
 * Если задан avatar_url — показываем фото; иначе кружок с первой буквой имени.
 */
export function Avatar({ name, src, size = 'lg', className }: AvatarProps) {
  const initial = (name?.charAt(0) ?? '?').toUpperCase();
  const sz = SIZES[size];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn(
          'shrink-0 rounded-full object-cover ring-2 ring-background',
          sz,
          className,
        )}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground',
        sz,
        className,
      )}
    >
      {initial}
    </div>
  );
}
