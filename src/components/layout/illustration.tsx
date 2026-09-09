'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Путь к фирменной иллюстрации. Один на все места, где она нужна. */
export const ILLUSTRATION = '/illustrations/reader.png';

interface IllustrationProps {
  className?: string;
  /** Описание для читалки экрана. Пусто - картинка декоративная. */
  alt?: string;
  /** Что показать вместо иллюстрации, если файла нет. */
  fallback?: React.ReactNode;
}

/**
 * Фирменная иллюстрация.
 *
 * Если файла нет, показываем запасной вариант, а при его отсутствии -
 * ничего: пустое место лучше, чем иконка битой картинки посреди
 * главной. Так же ведет себя обложка книги, когда источник не отдал
 * изображение.
 */
export function Illustration({
  className,
  alt = '',
  fallback = null,
}: IllustrationProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ILLUSTRATION}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('h-auto w-full select-none', className)}
    />
  );
}
