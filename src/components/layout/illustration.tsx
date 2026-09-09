'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Путь к фирменной иллюстрации. Один на все места, где она нужна. */
export const ILLUSTRATION = '/illustrations/reader.png';

/** Размеры исходника - нужны, чтобы место под картинку резервировалось. */
const WIDTH = 1799;
const HEIGHT = 1285;

interface IllustrationProps {
  className?: string;
  /** Описание для читалки экрана. Пусто - картинка декоративная. */
  alt?: string;
  /** Что показать вместо иллюстрации, если файла нет. */
  fallback?: React.ReactNode;
  /**
   * Картинка на первом экране: грузим сразу, без ленивой загрузки.
   * Она же и есть самый крупный элемент экрана, от нее зависит LCP.
   */
  priority?: boolean;
  /** Ширина слота под картинку на разных экранах - для выбора размера. */
  sizes?: string;
}

/**
 * Фирменная иллюстрация.
 *
 * Идет через next/image: исходник - PNG на 1800 точек в ширину, а
 * показывается он в колонке вдвое уже. Без пережатия страница тянула бы
 * лишние сотни килобайт, а next/image отдает webp нужного размера и
 * резервирует место, чтобы верстка не прыгала при загрузке.
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
  priority = false,
  sizes = '(min-width: 1024px) 520px, 100vw',
}: IllustrationProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;

  return (
    <Image
      src={ILLUSTRATION}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={WIDTH}
      height={HEIGHT}
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
      className={cn('h-auto w-full select-none', className)}
    />
  );
}
