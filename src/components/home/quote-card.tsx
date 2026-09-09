import type { BookQuote } from '@/lib/quotes/data';

interface QuoteCardProps {
  quote: BookQuote;
}

/**
 * Цитата из книги - типографический разворот на ленте.
 *
 * Карточки здесь намеренно нет: внутри цветной ленты рамки не ставим, а
 * крупная серифная строка на плотном фоне и есть то, ради чего лента
 * существует.
 */
export function QuoteCard({ quote }: QuoteCardProps) {
  return (
    <section>
      <figure className="mx-auto max-w-3xl text-center">
        <blockquote className="text-display-sm font-serif text-balance">
          «{quote.text}»
        </blockquote>
        <figcaption className="mt-6 text-sm opacity-75">
          <span className="font-medium">{quote.author}</span>
          {' - '}
          <em>{quote.work}</em>
        </figcaption>
      </figure>
    </section>
  );
}
