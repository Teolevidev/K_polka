'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Иллюстрация секции лендинга.
 *
 * Файлы лежат в public/illustrations. Пока какого-то из них нет,
 * компонент не рисует ничего - вместо иконки битой картинки. Так же
 * ведут себя обложка книги и лампа: секция остается верстабельной без
 * картинки, и файл включает ее сам, когда появляется.
 *
 * Размер задан крупным и одинаковым для всех: иллюстрации векторные,
 * реальный размер на экране определяется классом контейнера.
 */
export type LandingArt =
  | 'illo-book-spread'
  | 'illo-warm-lamp'
  | 'illo-book-stack'
  | 'illo-book-shelf'
  | 'illo-flying-pages';

interface LandingIllustrationProps {
  name: LandingArt;
  className?: string;
  /** Размер стороны для next/image. На экране решает класс. */
  size?: number;
}

export function LandingIllustration({
  name,
  className,
  size = 320,
}: LandingIllustrationProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <Image
      src={`/illustrations/${name}.svg`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn('h-auto w-full select-none', className)}
    />
  );
}
