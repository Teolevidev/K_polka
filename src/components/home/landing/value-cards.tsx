import Link from 'next/link';
import { LandingIllustration, type LandingArt } from '@/components/layout/landing-illustration';

/**
 * Три ценности клуба.
 *
 * Третья - «Список к прочтению» - появилась осознанно. Клуб это трекер
 * И прочитанного, И того, что хочется прочитать: у полки до сих пор
 * была видна только первая половина, хотя в данных обе есть с самого
 * начала (user_books.status знает 'read' и 'want').
 */

interface Value {
  art: LandingArt;
  title: string;
  text: string;
  href: string;
  linkLabel: string;
}

const VALUES: Value[] = [
  {
    art: 'illo-book-spread',
    title: 'Читаем вместе',
    text: 'Одна книга на всех и разговор о ней: не лента отзывов незнакомцев, а обсуждение со своими.',
    href: '/#club',
    linkLabel: 'Как проходит клуб',
  },
  {
    art: 'illo-book-shelf',
    title: 'Трекер прочитанного',
    text: 'Полка с оценками и датами. Видно, что прочитано за год и как меняется вкус.',
    href: '/signin?next=/library',
    linkLabel: 'Завести полку',
  },
  {
    art: 'illo-warm-lamp',
    title: 'Список к прочтению',
    text: 'Отдельный список того, до чего хочется добраться. Книга не теряется между «увидел» и «прочитал».',
    href: '/discover',
    linkLabel: 'Найти книгу',
  },
];

export function ValueCards() {
  return (
    <section className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h2 className="font-serif text-2xl leading-tight sm:text-3xl">
          Зачем это нужно
        </h2>
        <p className="text-muted-foreground">
          Три вещи, ради которых сюда возвращаются.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {VALUES.map((value) => (
          <li
            key={value.title}
            className="flex flex-col gap-3 rounded-card bg-card p-6 text-card-foreground"
          >
            <div className="flex h-24 items-end">
              <LandingIllustration name={value.art} className="max-h-full w-auto" />
            </div>

            <h3 className="font-serif text-xl leading-snug">{value.title}</h3>
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
              {value.text}
            </p>
            <Link
              href={value.href}
              className="text-sm font-medium underline underline-offset-4 hover:no-underline"
            >
              {value.linkLabel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
