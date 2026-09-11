import { LandingIllustration, type LandingArt } from '@/components/layout/landing-illustration';

/**
 * «Как это работает» - три шага пути новичка.
 *
 * Стоит сразу за героем: гость только что прочитал, что это клуб, и
 * следующий его вопрос - «а что я буду делать». Каталог книг до этого
 * места показывать рано, он отвечает на другой вопрос.
 */

interface Step {
  art: LandingArt;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  {
    art: 'illo-book-spread',
    title: 'Вступаете',
    text: 'Небольшой закрытый клуб: все друг друга видят, случайных людей нет.',
  },
  {
    art: 'illo-book-stack',
    title: 'Читаете вместе',
    text: 'Книга месяца и своя скорость: клуб задает ритм, а не расписание.',
  },
  {
    art: 'illo-flying-pages',
    title: 'Обсуждаете и ведете полку',
    text: 'Разговор о прочитанном, отметки и оценки - все в одном месте.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 space-y-8">
      <div className="max-w-2xl space-y-2">
        <h2 className="font-serif text-2xl leading-tight sm:text-3xl">
          Как это работает
        </h2>
        <p className="text-muted-foreground">
          Три шага - и вы внутри. Ничего сложнее не потребуется.
        </p>
      </div>

      <ol className="grid gap-6 sm:grid-cols-3 sm:gap-8">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-3">
            {/* Картинка над текстом и с фиксированной высотой: иначе
                колонки разной длины разъезжаются по вертикали. */}
            <div className="flex h-28 items-end sm:h-32">
              <LandingIllustration name={step.art} className="max-h-full w-auto" />
            </div>

            <p className="text-sm font-medium text-muted-foreground">
              Шаг {i + 1}
            </p>
            <h3 className="font-serif text-xl leading-snug">{step.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {step.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
