import Link from 'next/link';
import { SearchBar } from '@/components/layout/search-bar';
import { Button } from '@/components/ui/button';

/** Главный экран-приветствие на домашней странице. */
export function HomeHero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-secondary/40">
      <div className="container flex flex-col items-center py-14 text-center sm:py-20">
        <span className="mb-4 inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
          Читайте. Отмечайте. Делитесь.
        </span>

        <h1 className="max-w-2xl text-balance text-3xl font-bold leading-tight sm:text-5xl">
          Ваша библиотека — <span className="text-primary">в одном месте</span>
        </h1>

        <p className="mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
          Ведите список прочитанного, ставьте цели на год, находите новые книги
          по названию, автору или ISBN и делитесь впечатлениями с другими
          читателями.
        </p>

        <div className="mt-7 w-full max-w-md">
          <SearchBar placeholder="Найдите книгу: «Мастер и Маргарита»…" />
          <p className="mt-2 text-xs text-muted-foreground">
            Поиск понимает опечатки в названии и фамилии автора
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/signin">Завести полку</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/discover">Смотреть книги</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
