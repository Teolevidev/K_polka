import type { BookQuote } from '@/lib/quotes/data';

interface QuoteCardProps {
  quote: BookQuote;
}

/**
 * Цитата из книги - единственный цветной акцент в теле страницы.
 *
 * Раньше это была лента во всю ширину экрана. Полоса ради двух строк
 * текста разрывала страницу пополам, поэтому теперь цитата живет в
 * карточке: цвет остался, а ритм страницы не ломается.
 */
export function QuoteCard({ quote }: QuoteCardProps) {
  return (
    <figure className="rounded-card bg-sky px-6 py-12 text-center text-ink sm:px-12 sm:py-16">
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
