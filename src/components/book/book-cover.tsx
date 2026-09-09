'use client';

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BookCoverProps {
  src: string | null | undefined;
  title: string;
  className?: string;
  sizes?: string;
}

/**
 * Обложка книги с запасным вариантом.
 * Если изображения нет или оно не загрузилось — рисуем плейсхолдер
 * с инициалами названия.
 */
export function BookCover({ src, title, className }: BookCoverProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <div
      className={cn(
        // Ни рамок, ни бейджей: обложка лежит прямо на поверхности,
        // от страницы ее отделяет только мягкая тень.
        'aspect-cover relative overflow-hidden rounded-lg bg-secondary shadow-cover',
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Обложка книги «${title}»`}
          loading="lazy"
          decoding="async"
          // Часть каталогов отдаёт картинки только без Referer: с чужим
          // источником в заголовке приходит 403, и обложка не появляется.
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
          <BookOpen className="size-6 text-muted-foreground/60" aria-hidden="true" />
          <span className="line-clamp-3 font-serif text-xs text-muted-foreground">
            {title}
          </span>
        </div>
      )}
    </div>
  );
}
