import type { NormalizedBook } from '@/lib/books/types';
import { encodeBookRef } from '@/lib/books/ref';
import { getBooksByAuthor } from '@/lib/books/related';
import { BookCard } from './book-card';

/**
 * Блоки-соседи на странице книги: другие издания и другие книги автора.
 *
 * Оба компонента ходят во внешний источник, поэтому вызывать их нужно
 * внутри Suspense: страница книги должна показаться сразу, а не ждать
 * два дополнительных запроса.
 */

interface RowProps {
  title: string;
  books: NormalizedBook[];
  emptyHint?: string;
}

function RelatedRow({ title, books, emptyHint }: RowProps) {
  if (books.length === 0) {
    return emptyHint ? (
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      </section>
    ) : null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="no-scrollbar -mx-2 overflow-x-auto px-2">
        <div className="flex gap-2">
          {books.map((b) => (
            <BookCard
              key={`${b.source}:${b.sourceId}`}
              book={{
                title: b.title,
                authors: b.authors,
                coverUrl: b.coverUrl,
                href: `/book/${encodeBookRef(b.source, b.sourceId)}`,
              }}
              className="w-[120px] shrink-0 sm:w-[136px]"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Скелет на время загрузки блока. */
export function RelatedRowSkeleton({ title }: { title: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="aspect-cover w-[120px] shrink-0 animate-pulse rounded-md bg-secondary sm:w-[136px]"
          />
        ))}
      </div>
    </section>
  );
}

export async function AuthorBooks({ book }: { book: NormalizedBook }) {
  const books = await getBooksByAuthor(book);
  return <RelatedRow title="Другие книги автора" books={books} />;
}
