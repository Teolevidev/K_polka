'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Путь к фирменной иллюстрации. Один на все места, где она нужна. */
export const ILLUSTRATION = '/illustrations/reader.png';

interface IllustrationProps {
  className?: string;
  /** Описание для читалки экрана. Пусто - картинка декоративная. */
  alt?: string;
}

/**
 * Фирменная иллюстрация.
 *
 * Если файла нет, компонент не рисует ничего: пустое место лучше, чем
 * иконка битой картинки посреди главной. Так же ведет себя обложка
 * книги, когда источник не отдал изображение.
 */
export function Illustration({ className, alt = '' }: IllustrationProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

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
