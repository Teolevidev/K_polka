import Link from 'next/link';
import { Star } from 'lucide-react';
import { BookCover } from './book-cover';
import { cn } from '@/lib/utils';

export interface BookCardData {
  title: string;
  authors: string[];
  coverUrl: string | null;
  href: string;
  rating?: number | null;
  /** Позиция в топе — рисует крупную цифру. */
  rank?: number;
}

interface BookCardProps {
  book: BookCardData;
  className?: string;
}

/** Карточка книги для каруселей и сеток. */
export function BookCard({ book, className }: BookCardProps) {
  return (
    <Link
      href={book.href}
      className={cn(
        'group flex flex-col gap-2 rounded-lg p-2 transition-colors hover:bg-secondary/60',
        className,
      )}
    >
      <div className="relative">
        <BookCover
          src={book.coverUrl}
          title={book.title}
          className="transition-transform group-hover:-translate-y-0.5"
        />
        {book.rank !== undefined && (
          <span
            className="absolute -bottom-1 -left-1 flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-md"
            aria-label={`Позиция ${book.rank}`}
          >
            {book.rank}
          </span>
        )}
      </div>

      <div className="space-y-0.5 px-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{book.title}</p>
        {book.authors.length > 0 && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {book.authors.join(', ')}
          </p>
        )}
        {typeof book.rating === 'number' && book.rating > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3 fill-accent text-accent" aria-hidden="true" />
            {book.rating.toFixed(1)}
          </span>
        )}
      </div>
    </Link>
  );
}
