import type { Metadata } from 'next';
import { BookCard } from '@/components/book/book-card';
import { showcaseSections } from '@/lib/books/showcase';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Обзор книг' };

export default function DiscoverPage() {
  const books = [...showcaseSections.popular, ...showcaseSections.adminPicks];

  return (
    <div>
      <PageHeader
        title="Обзор книг"
        subtitle="Подборка популярных книг. Скоро здесь появятся жанры, кураторские полки и то, что читают другие."
      />

      <div className="container py-8">
       <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {books.map((book, i) => (
          <BookCard key={`${book.href}-${i}`} book={book} />
        ))}
       </div>
      </div>
    </div>
  );
}
