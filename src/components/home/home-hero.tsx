import Link from 'next/link';
import { Illustration } from '@/components/layout/illustration';
import { BookCover } from '@/components/book/book-cover';
import { Button } from '@/components/ui/button';
import { SectionBand } from '@/components/layout/section-band';
import { showcaseSections } from '@/lib/books/showcase';

/**
 * Первый экран - по образцу источника.
 *
 * Слева серифный заголовок в две строки, подзаголовок гротеском и одна
 * светлая кнопка-таблетка. Справа иллюстрация, крупная: она занимает
 * больше половины ширины и уходит вниз за нижнее поле ленты, поэтому
 * лента при этом остается низкой.
 *
 * Поиска здесь намеренно нет. Он стоял второй строкой, дублируя шапку,
 * и уводил гостя в продуктовый сценарий: искать книгу вместо того,
 * чтобы понять, куда он попал. Поиск остался в шапке - он никуда не
 * делся и доступен с любой страницы.
 *
 * Главное действие - вступить в клуб, а не завести полку: клуб и есть
 * продукт, полка - его часть. «Завести полку» осталась вторичной
 * ссылкой для тех, кому ближе трекер.
 */
export function HomeHero({ signedIn = false }: { signedIn?: boolean }) {
  const collage = showcaseSections.popular.slice(0, 5);

  return (
    <SectionBand tone="forest" className="overflow-hidden pb-0 pt-10 sm:pt-14">
      <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]">
        {/* Левая колонка: заголовок и действия */}
        <div className="pb-10 text-cream sm:pb-14">
          <h1 className="font-serif text-[clamp(2.25rem,4.6vw,3.75rem)] leading-[1.02] text-balance">
            Ваша библиотека
            <br />в одном месте
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed opacity-90 sm:text-lg">
            Книжный клуб и трекер прочитанного. Ведите список, ставьте цели и
            обсуждайте книги с теми, кто читает рядом.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button size="lg" variant="onBand" asChild>
              <Link href={signedIn ? '/profile' : '/signin'}>
                {signedIn ? 'В мой кабинет' : 'Вступить в клуб'}
              </Link>
            </Button>
            <Link
              href={signedIn ? '/library' : '/signin?next=/library'}
              className="text-base font-medium underline underline-offset-4 hover:no-underline"
            >
              Завести полку
            </Link>
          </div>
        </div>

        {/* Правая колонка: иллюстрация во всю высоту ленты, до нижнего
            края. Отрицательные поля дают ей выйти за колонку - иначе
            она выглядит маленькой картинкой в углу. */}
        <div className="hidden lg:-mr-10 lg:block xl:-mr-16">
          <Illustration
            priority
            sizes="(min-width: 1024px) 820px, 100vw"
            className="ml-auto w-full max-w-[820px]"
            fallback={
              <div className="flex items-end justify-center gap-3 pb-10">
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
