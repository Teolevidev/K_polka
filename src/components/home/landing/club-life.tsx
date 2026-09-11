import { CalendarDays, Users, UserRound } from 'lucide-react';
import { SectionBand } from '@/components/layout/section-band';
import { LandingIllustration } from '@/components/layout/landing-illustration';

/**
 * «Клуб живой» - про принадлежность, а не про функции.
 *
 * Остальные секции объясняют, что можно делать. Эта отвечает на другой
 * вопрос: каково там быть. Поэтому здесь нет ни одной кнопки и ни
 * одного пункта интерфейса - только ритм, встречи и живой человек,
 * который ведет.
 */

const FACTS = [
  {
    icon: CalendarDays,
    title: 'Ритм по неделям',
    text: 'Книга месяца делится на недели. Отстал - догоняешь, никто не подгоняет.',
  },
  {
    icon: Users,
    title: 'Живые встречи',
    text: 'Онлайн по умолчанию, но мы в одном городе: иногда собираемся вживую.',
  },
  {
    icon: UserRound,
    title: 'Ведущий-куратор',
    text: 'У каждой книги есть человек, который готовит вопросы и держит разговор.',
  },
];

export function ClubLife() {
  return (
    <SectionBand tone="forest" id="club" className="scroll-mt-20 py-12 sm:py-16">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
        <div className="space-y-8">
          <div className="max-w-xl space-y-3">
            <h2 className="font-serif text-2xl leading-tight sm:text-3xl">
              Клуб живой
            </h2>
            <p className="text-base leading-relaxed opacity-85">
              Это не лента и не каталог. Небольшой круг людей, которые читают
              одно и то же и разговаривают об этом - асинхронно, когда удобно,
              и вживую, когда получается.
            </p>
          </div>

          <ul className="grid gap-6 sm:grid-cols-3">
            {FACTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="space-y-2">
                <Icon className="size-6 opacity-90" aria-hidden="true" />
                <h3 className="font-medium">{title}</h3>
                <p className="text-sm leading-relaxed opacity-80">{text}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Иллюстрация отдельной колонкой, а не поверх текста: на
            промежуточных ширинах абсолютная картинка наезжала бы на
            строки. Колонка auto - без файла схлопывается в ноль. */}
        <div className="mx-auto w-32 lg:mx-0 lg:w-48">
          <LandingIllustration name="illo-warm-lamp" />
        </div>
      </div>
    </SectionBand>
  );
}
