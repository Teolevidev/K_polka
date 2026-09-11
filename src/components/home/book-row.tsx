import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BookCard, type BookCardData } from '@/components/book/book-card';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

interface BookRowProps {
  title: string;
  subtitle?: string;
  books: BookCardData[];
  showAllHref?: string;
  /** Рисовать ли номера позиций (для топов). */
  ranked?: boolean;
  /** Полоса стоит на цветной ленте - приглушенные тона там не читаются. */
  onBand?: boolean;
}

/**
 * Полоса обложек - основной контентный блок страницы.
 *
 * Кнопки листания вынесены в шапку блока, а не висят по бокам, как в
 * компоненте по умолчанию: полоса живет внутри колонки в 1200px, и
 * снаружи ей просто некуда деться. Заодно они не перекрывают обложки.
 *
 * Сами кнопки - подсказка для мыши: пальцем и колесом полоса листается
 * и без них, а на краях они гаснут сами.
 */
export function BookRow({
  title,
  subtitle,
  books,
  showAllHref,
  ranked,
  onBand = false,
}: BookRowProps) {
  if (books.length === 0) return null;

  return (
    <Carousel
      opts={{ align: 'start', slidesToScroll: 'auto', containScroll: 'trimSnaps' }}
      className="space-y-4"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-serif text-2xl leading-tight sm:text-3xl">{title}</h2>
          {subtitle && (
            <p className={cn('text-sm', onBand ? 'opacity-80' : 'text-muted-foreground')}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showAllHref && (
            <Link
              href={showAllHref}
              className="mr-1 hidden items-center gap-0.5 text-sm font-medium underline underline-offset-4 hover:no-underline sm:flex"
            >
              Показать все
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          )}
          <CarouselPrevious
            className={cn(
              'static hidden translate-y-0 sm:inline-flex',
              onBand && 'border-cream/40 bg-transparent text-cream hover:bg-cream/15',
            )}
          />
          <CarouselNext
            className={cn(
              'static hidden translate-y-0 sm:inline-flex',
              onBand && 'border-cream/40 bg-transparent text-cream hover:bg-cream/15',
            )}
          />
        </div>
      </div>

      <CarouselContent className="-ml-3">
        {books.map((book, i) => (
          <CarouselItem
            key={`${book.href}-${i}`}
            className="basis-1/3 pl-3 sm:basis-1/4 md:basis-1/5 lg:basis-1/6 xl:basis-[14.2857%]"
          >
            <BookCard book={ranked ? { ...book, rank: i + 1 } : book} />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
