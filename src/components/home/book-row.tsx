import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BookCard, type BookCardData } from '@/components/book/book-card';

interface BookRowProps {
  title: string;
  subtitle?: string;
  books: BookCardData[];
  showAllHref?: string;
  /** Рисовать ли номера позиций (для топов). */
  ranked?: boolean;
}

/**
 * Горизонтальная карусель книг — основной строительный блок главной.
 * Прокручивается свайпом на мобильных, скроллбар скрыт.
 */
export function BookRow({ title, subtitle, books, showAllHref, ranked }: BookRowProps) {
  if (books.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="container flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {showAllHref && (
          <Link
            href={showAllHref}
            className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary hover:underline"
          >
            Показать все
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      <div className="no-scrollbar overflow-x-auto">
        <div className="container flex gap-2">
          {books.map((book, i) => (
            <BookCard
              key={`${book.href}-${i}`}
              book={ranked ? { ...book, rank: i + 1 } : book}
              className="w-[132px] shrink-0 sm:w-[150px]"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
