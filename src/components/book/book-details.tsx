import { ExternalLink } from 'lucide-react';
import type { NormalizedBook } from '@/lib/books/types';
import { plural } from '@/lib/utils';

/** Человеческие названия языков - код вида «ru» читателю ничего не говорит. */
const LANGUAGE_NAMES: Record<string, string> = {
  ru: 'Русский',
  en: 'Английский',
  de: 'Немецкий',
  fr: 'Французский',
  es: 'Испанский',
  it: 'Итальянский',
  pl: 'Польский',
  uk: 'Украинский',
  be: 'Белорусский',
  ja: 'Японский',
  zh: 'Китайский',
};

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/**
 * Дата издания в читаемом виде.
 * Google отдаёт её то годом, то полной ISO-датой - показываем как есть
 * год и «20 июля 2010 г.» для полной даты.
 */
export function formatPublishedDate(value: string): string {
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (full) {
    const [, year, month, day] = full;
    const name = MONTHS[Number(month) - 1];
    return name ? `${Number(day)} ${name} ${year} г.` : value;
  }
  const yearMonth = /^(\d{4})-(\d{2})$/.exec(value);
  if (yearMonth) {
    const [, year, month] = yearMonth;
    const name = MONTHS[Number(month) - 1];
    return name ? `${name[0].toUpperCase()}${name.slice(1)} ${year} г.` : value;
  }
  return value;
}

/** Строки блока «Об издании» - только те, что источник действительно знает. */
export function buildEditionFacts(book: NormalizedBook): {
  label: string;
  value: string;
}[] {
  const facts: { label: string; value: string }[] = [];

  if (book.publishedDate) {
    facts.push({ label: 'Дата издания', value: formatPublishedDate(book.publishedDate) });
  }
  if (book.publisher) facts.push({ label: 'Издательство', value: book.publisher });
  if (book.pageCount) {
    facts.push({
      label: 'Объем',
      value: `${book.pageCount} ${plural(book.pageCount, 'страница', 'страницы', 'страниц')}`,
    });
  }
  if (book.language) {
    facts.push({
      label: 'Язык',
      value: LANGUAGE_NAMES[book.language] ?? book.language.toUpperCase(),
    });
  }
  if (book.printType) facts.push({ label: 'Формат', value: book.printType });
  if (book.series?.number) {
    facts.push({
      label: 'В серии',
      value: book.series.title
        ? `${book.series.title}, книга ${book.series.number}`
        : `Книга ${book.series.number}`,
    });
  }
  const isbns = [book.isbn13, book.isbn10].filter(Boolean);
  if (isbns.length) facts.push({ label: 'ISBN', value: isbns.join(', ') });
  if (book.editionCount && book.editionCount > 1) {
    facts.push({
      label: 'Известных изданий',
      value: String(book.editionCount),
    });
  }

  return facts;
}

/** Блок «Об издании»: всё, что источник знает про конкретное издание. */
export function BookDetails({ book }: { book: NormalizedBook }) {
  const facts = buildEditionFacts(book);
  if (facts.length === 0 && !book.sourceUrl) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Об издании</h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border bg-secondary/40 p-4 text-sm sm:grid-cols-3">
        {facts.map(({ label, value }) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="break-words font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {book.sourceUrl && (
        <a
          href={book.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Карточка издания в источнике
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      )}
    </section>
  );
}
