import type { BookQuote } from '@/lib/quotes/data';
import { LeafPattern } from '@/components/layout/leaf-pattern';

interface QuoteCardProps {
  quote: BookQuote;
}

/**
 * Цитата из книги - единственный цветной акцент в теле страницы.
 *
 * Тот же зеленый и тот же узор, что у первого экрана: страница
 * начинается и заканчивается одним цветом, и цитата читается как часть
 * той же обложки, а не как отдельная плашка другого цвета.
 *
 * Раньше это была лента во всю ширину экрана. Полоса ради двух строк
 * текста разрывала страницу пополам, поэтому теперь цитата живет в
 * карточке: цвет остался, а ритм страницы не ломается.
 */
export function QuoteCard({ quote }: QuoteCardProps) {
  return (
    <figure className="rounded-card relative isolate overflow-hidden bg-forest px-6 py-12 text-center text-cream sm:px-12 sm:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 text-cream"
        style={{ opacity: 'var(--pattern-opacity)' }}
      >
        <LeafPattern className="h-full w-full" />
      </div>

      <blockquote className="text-display-sm mx-auto max-w-2xl font-serif text-balance">
        «{quote.text}»
      </blockquote>
      <figcaption className="mt-6 text-sm opacity-75">
        <span className="font-medium">{quote.author}</span>
        {' - '}
        <em>{quote.work}</em>
      </figcaption>
    </figure>
  );
}
