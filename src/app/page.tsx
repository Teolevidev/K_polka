import { HomeHero } from '@/components/home/home-hero';
import { BookRow } from '@/components/home/book-row';
import { FeatureGrid } from '@/components/home/feature-grid';
import { showcaseSections } from '@/lib/books/showcase';

export default function HomePage() {
  return (
    <div className="space-y-12 pb-8">
      <HomeHero />

      <BookRow
        title="Популярное сейчас"
        subtitle="Что читают в «Книжной полке» на этой неделе"
        books={showcaseSections.popular}
        showAllHref="/discover"
        ranked
      />

      <FeatureGrid />

      <BookRow
        title="Выбор редакции"
        subtitle="Книги, которые стоит добавить на полку"
        books={showcaseSections.editorsChoice}
        showAllHref="/discover"
      />
    </div>
  );
}
