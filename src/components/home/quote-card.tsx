import { Quote } from 'lucide-react';
import type { BookQuote } from '@/lib/quotes/data';

interface QuoteCardProps {
  quote: BookQuote;
}

/** Карточка с крылатой цитатой из книги. */
export function QuoteCard({ quote }: QuoteCardProps) {
  return (
    <section className="container">
      <figure className="relative overflow-hidden rounded-xl border border-border bg-card p-6 sm:p-8">
        <Quote
          className="absolute right-5 top-5 size-10 text-primary/15"
          aria-hidden="true"
        />
        <blockquote className="font-serif text-xl leading-snug sm:text-2xl">
          «{quote.text}»
        </blockquote>
        <figcaption className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{quote.author}</span>
          {' — '}
          <em>{quote.work}</em>
        </figcaption>
      </figure>
    </section>
  );
}
