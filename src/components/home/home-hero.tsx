import Link from 'next/link';
import { SearchBar } from '@/components/layout/search-bar';
import { Illustration } from '@/components/layout/illustration';
import { BookCover } from '@/components/book/book-cover';
import { showcaseSections } from '@/lib/books/showcase';
import { Button } from '@/components/ui/button';
import { SectionBand } from '@/components/layout/section-band';

/**
 * Первый экран - по опорному баннеру: слева крупный вордмарк в две
 * строки с оранжевой чертой и коротким подзаголовком, справа
 * иллюстрация, на фоне зеленой ленты - лепестки.
 *
 * Вордмарк набран гротеском, а не серифом, хотя остальные заголовки в
 * системе серифные: на баннере это фирменная плашка, а не обычный
 * заголовок, и жирный гротеск в верхнем регистре - ее узнаваемая часть.
 *
 * Поиск и кнопка на баннере не нарисованы, но на главной без них
 * нельзя: это единственный экран, с которого начинают. Стоят ниже
 * подзаголовка, чтобы не спорить с вордмарком.
 */
export function HomeHero() {
  const collage = showcaseSections.popular.slice(0, 5);

  return (
    <SectionBand tone="forest">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-12">
        {/* Левая колонка: вордмарк, черта, подзаголовок, действия */}
        <div className="text-cream">
          <h1 className="font-sans text-[clamp(2.75rem,8vw,5.5rem)] font-extrabold uppercase leading-[0.92] tracking-tight">
            Книжная
            <br />
            полка
          </h1>

          {/* Черта под вордмарком - единственное место, где в системе
              появляется оранжевый. */}
          <div className="mt-5 h-1.5 w-32 rounded-full bg-orange sm:w-40" />

          <p className="mt-7 text-lg leading-snug sm:text-xl">
            Книжный клуб.
            <br />
            Трекер прочитанного.
          </p>

          <div className="mt-8 max-w-md">
            <SearchBar placeholder="Найдите книгу: «Мастер и Маргарита»" />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
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

        {/* Правая колонка: иллюстрация, а пока ее файла нет - «стопка»
            обложек. Пустая колонка выглядела бы как недогрузившийся
            блок, а обложки - тот же мотив: книга как арт-объект. */}
        <div className="hidden lg:block">
          <Illustration
            fallback={
              <div className="flex items-end justify-center gap-3">
                {collage.map((book, i) => (
                  <div
                    key={book.title}
                    className="w-[96px] shrink-0 xl:w-[112px]"
                    style={{
                      transform: `translateY(${Math.abs(i - 2) * 14}px) rotate(${(i - 2) * 2.5}deg)`,
                    }}
                  >
                    <BookCover src={book.coverUrl} title={book.title} />
                  </div>
                ))}
              </div>
            }
          />
        </div>
      </div>
    </SectionBand>
  );
}
