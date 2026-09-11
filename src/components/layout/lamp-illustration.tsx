'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Путь к иллюстрации с лампой и ее размеры в исходнике. */
export const LAMP = '/illustrations/lamp.png';
const WIDTH = 1600;
const HEIGHT = 1440;

/**
 * Лампа над книгами - иллюстрация ленты «Выбор администратора».
 *
 * Извлечена из присланного PDF без потерь: внутри лежал FlateDecode,
 * то есть обычный zlib, а не JPEG. Альфа-канал приехал отдельным
 * потоком SMask и приклеен обратно - без него мягкое свечение вокруг
 * лампы стало бы черным прямоугольником.
 *
 * Идет через next/image: исходник 1600 точек в ширину, а показывается в
 * колонке вчетверо уже. Если файла вдруг нет, колонка схлопывается -
 * она размечена как auto.
 */
export function LampIllustration({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <Image
      src={LAMP}
      alt=""
      aria-hidden="true"
      width={WIDTH}
      height={HEIGHT}
      sizes="(min-width: 1024px) 208px, 128px"
      onError={() => setFailed(true)}
      className={cn('h-auto w-full select-none', className)}
    />
  );
}
