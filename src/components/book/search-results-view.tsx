'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookCard, type BookCardData } from './book-card';

interface SearchResultsViewProps {
  books: BookCardData[];
  initial?: number;
}

/** Сетка результатов поиска с кнопкой «Показать ещё». */
export function SearchResultsView({ books, initial = 12 }: SearchResultsViewProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? books : books.slice(0, initial);
  const remaining = books.length - initial;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {visible.map((b, i) => (
          <BookCard key={`${b.href}-${i}`} book={b} />
        ))}
      </div>
      {!showAll && remaining > 0 && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setShowAll(true)}>
            <ChevronDown className="size-4" />
            Показать ещё {remaining}
          </Button>
        </div>
      )}
    </div>
  );
}
