import Link from 'next/link';
import { SearchBar } from '@/components/layout/search-bar';
import { BookCover } from '@/components/book/book-cover';
import { Button } from '@/components/ui/button';
import { SectionBand } from '@/components/layout/section-band';
import { showcaseSections } from '@/lib/books/showcase';

/**
 * Первый экран - брендовая лента: слева заголовок, подпись и одна
 * светлая кнопка-таблетка, справа арт-объект.
 *
 * В опорном стиле справа стоит плоская иллюстрация. Своих иллюстраций у
 * нас нет, а рисовать чужие смысла нет: у стиля есть второй, более
 * подходящий нам мотив - книжные обложки как редакционная графика.
 * Собираем из них разложенную «стопку».
 */
export function HomeHero() {
  const collage = showcaseSections.popular.slice(0, 5);

  return (
    <SectionBand tone="forest">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,520px)_1fr] lg:gap-16">
        {/* Левая колонка: текст и действие */}
        <div>
          <p className="text-sm font-medium uppercase tracking-widest opacity-70">
            Читайте. Отмечайте. Делитесь.
          </p>

          <h1 className="text-display mt-5 font-serif text-balance">
            Ваша библиотека в одном месте
          </h1>

          <p className="mt-6 max-w-md text-base leading-relaxed opacity-85 sm:text-lg">
            Ведите список прочитанного, ставьте цели на год, находите книги по
            названию, автору или ISBN и обсуждайте их с теми, кто читает рядом.
          </p>

          <div className="mt-8 max-w-md">
            <SearchBar placeholder="Найдите книгу: «Мастер и Маргарита»" />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button size="lg" variant="onBand" asChild>
              <Link href="/signin">Завести полку</Link>
            </Button>
            <Link
              href="/discover"
              className="text-base font-medium underline underline-offset-4 hover:no-underline"
            >
              Смотреть книги
            </Link>
          </div>
        </div>

        {/* Правая колонка: обложки как редакционная графика */}
        <div
          className="hidden justify-center lg:flex"
          aria-hidden="true"
        >
          <div className="flex items-end gap-3">
            {collage.map((book, i) => (
              <div
                key={book.title}
                className="w-[104px] shrink-0 xl:w-[124px]"
                // Легкий разворот «стопки»: середина выше краев.
                style={{
                  transform: `translateY(${Math.abs(i - 2) * 14}px) rotate(${(i - 2) * 2.5}deg)`,
                }}
              >
                <BookCover src={book.coverUrl} title={book.title} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionBand>
  );
}
