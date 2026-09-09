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
 * Горизонтальная полоса обложек - основной контентный блок.
 *
 * Живет внутри ленты-секции, поэтому своей ширины не задает. Полоса
 * намеренно выходит за поля ленты и обрезается краем экрана: так видно,
 * что ряд продолжается и его можно прокрутить.
 */
export function BookRow({ title, subtitle, books, showAllHref, ranked }: BookRowProps) {
  if (books.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-serif text-2xl leading-tight sm:text-3xl">{title}</h2>
          {subtitle && <p className="text-sm opacity-70">{subtitle}</p>}
        </div>
        {showAllHref && (
          <Link
            href={showAllHref}
            className="flex shrink-0 items-center gap-0.5 text-sm font-medium underline underline-offset-4 hover:no-underline"
          >
            Показать все
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        <div className="flex gap-3">
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
