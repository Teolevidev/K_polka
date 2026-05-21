import type { Metadata } from 'next';
import { BookCard } from '@/components/book/book-card';
import { showcaseSections } from '@/lib/books/showcase';

export const metadata: Metadata = { title: 'Обзор книг' };

export default function DiscoverPage() {
  const books = [...showcaseSections.popular, ...showcaseSections.editorsChoice];

  return (
    <div className="container space-y-6 py-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Обзор книг</h1>
        <p className="text-sm text-muted-foreground">
          Подборка популярных книг. Скоро здесь появятся жанры, кураторские
          полки и то, что читают другие.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {books.map((book, i) => (
          <BookCard key={`${book.href}-${i}`} book={book} />
        ))}
      </div>
    </div>
  );
}
