import { Library, Target, Flame, Users } from 'lucide-react';

const features = [
  {
    icon: Library,
    title: 'Личная библиотека',
    text: 'Полки «Читаю», «Прочитано», «Хочу прочесть» плюс собственные подборки.',
  },
  {
    icon: Target,
    title: 'Цели на год',
    text: 'Поставьте цель по числу книг и следите за прогрессом в реальном времени.',
  },
  {
    icon: Flame,
    title: 'Серии и достижения',
    text: 'Отмечайте дни чтения, держите серию и открывайте бейджи.',
  },
  {
    icon: Users,
    title: 'Книжный клуб',
    text: 'Отзывы, обсуждения и закрытый клуб с «книгой месяца».',
  },
];

/** Сетка ключевых возможностей приложения. */
export function FeatureGrid() {
  return (
    <section className="container">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="rounded-lg border border-border bg-card p-5"
          >
            <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
