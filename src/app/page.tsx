import { HomeHero } from '@/components/home/home-hero';
import { HowItWorks } from '@/components/home/landing/how-it-works';
import { ValueCards } from '@/components/home/landing/value-cards';
import { ClubLife } from '@/components/home/landing/club-life';
import { FinalCta } from '@/components/home/landing/final-cta';
import { BookRow } from '@/components/home/book-row';

import { showcaseSections } from '@/lib/books/showcase';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
import { getCurrentEditorialPicks } from '@/lib/editorial/queries';
import type { BookCardData } from '@/components/book/book-card';
import { SectionBand } from '@/components/layout/section-band';
import { LampIllustration } from '@/components/layout/lamp-illustration';

/**
 * Публичная главная - лендинг клуба.
 *
 * У сайта два разных читателя, и раньше они делили одну страницу:
 * гость видел витрину вперемешку с чужими полками и целями, а участник
 * - рекламу того, что у него уже есть. Теперь граница проведена:
 * здесь рассказ о клубе и вход в него, а полки, цели, статистика,
 * рекомендация и опрос живут в кабинете (/profile).
 *
 * Порядок секций - это путь гостя: что это (герой) -> что я буду
 * делать (как это работает) -> зачем мне это (три ценности) -> каково
 * там быть (клуб живой) -> что вы читаете (каталог) -> вступить
 * (финальный CTA). Каталог намеренно опущен вниз: книгами мы не
 * отличаемся, они есть везде.
 *
 * Вошедшему страница показывается та же, меняются только надписи на
 * кнопках: они ведут в кабинет, а не на вход.
 */
export default async function HomePage() {
  const configured = isSupabaseConfigured();

  const [user, editorialPicks] = await Promise.all([
    configured ? getCurrentUser() : Promise.resolve(null),
    configured ? getCurrentEditorialPicks().catch(() => []) : Promise.resolve([]),
  ]);

  const signedIn = Boolean(user);

  // Маркированные администратором книги - если есть; иначе статичная витрина.
  const adminPicks: BookCardData[] =
    editorialPicks.length > 0
      ? editorialPicks.map((p) => ({
          title: p.title,
          authors: p.authors ? p.authors.split(', ').filter(Boolean) : [],
          coverUrl: p.coverUrl,
          href: `/book/${p.bookRef}`,
        }))
      : showcaseSections.adminPicks;

  return (
    /*
     * Одна полноширинная лента - герой, дальше страница собирается
     * внутри колонки. Сплошные цветные полосы во весь экран одна за
     * другой читались как набор баннеров: глазу не за что зацепиться и
     * непонятно, где кончается один блок и начинается другой. Теперь
     * цвет во всю ширину - редкий акцент, а не структура.
     */
    <div>
      <HomeHero signedIn={signedIn} />

      <div className="container max-w-[1200px] space-y-14 py-12 sm:space-y-16">
        <HowItWorks />
        <ValueCards />
      </div>

      <ClubLife />

      <div className="container max-w-[1200px] space-y-14 py-12 sm:space-y-16">
        <BookRow
          title="Популярное сейчас"
          subtitle="Что читают в «Книжной полке» на этой неделе"
          books={showcaseSections.popular}
          showAllHref="/discover"
          ranked
        />
      </div>

      {/* Выбор редакции - на зеленой ленте с узором, как первый экран:
          страница начинается и заканчивается фирменным цветом.

          Иллюстрация встанет отдельной колонкой справа, а на узком
          экране - строкой над полосой. Абсолютным позиционированием
          поверх карусели она бы наезжала на обложки на промежуточных
          ширинах, поэтому только поток. */}
      <SectionBand tone="forest" className="py-12 sm:py-14">
        {/* Иллюстрация стоит отдельной колонкой, а не поверх полосы:
            на промежуточных ширинах абсолютная картинка наезжала бы на
            обложки. Колонка размечена как auto - пока файла лампы нет,
            она схлопывается в ноль и пустого места не остается.
            На узком экране лампа уходит наверх и уменьшается. */}
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10">
          <div className="order-2 min-w-0 lg:order-1">
            <BookRow
              title="Выбор администратора этой недели"
              subtitle="Пять книг, которые советует команда «Книжной полки»"
              books={adminPicks}
              showAllHref="/discover"
              onBand
            />
          </div>

          <div className="order-1 mx-auto w-32 lg:order-2 lg:mx-0 lg:w-52">
            <LampIllustration />
          </div>
        </div>
      </SectionBand>

      <FinalCta signedIn={signedIn} />
    </div>
  );
}
