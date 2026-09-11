import Link from 'next/link';
import { Logo } from './logo';

/**
 * Подвал - завершающая темная лента.
 *
 * В ритме секций это самая темная поверхность страницы: после нее
 * ничего нет, поэтому цвет плотнее любого другого фона.
 *
 * Три колонки повторяют деление сайта: рассказ о клубе, публичная
 * витрина и связь. «Моя полка» отсюда ушла вместе с публичным меню -
 * гостю она обещает то, чего он не увидит.
 */
const COLUMNS = [
  {
    title: 'Клуб',
    links: [
      { href: '/#how', label: 'Как это работает' },
      { href: '/#club', label: 'Клуб живой' },
      { href: '/blog', label: 'Блог' },
      { href: '/signin', label: 'Вступить в клуб' },
    ],
  },
  {
    title: 'Читать',
    links: [
      { href: '/discover', label: 'Обзор книг' },
      { href: '/search', label: 'Поиск' },
      { href: '/people', label: 'Участники' },
    ],
  },
];

/**
 * Контакты и соцсети берутся из окружения и рисуются только тогда,
 * когда заданы. Выдумывать адрес и ставить его в подвал нельзя: по
 * нему кто-нибудь напишет. Пока переменных нет, колонка показывает
 * одну строку про то, где нас найти.
 */
const CONTACTS = [
  { href: process.env.NEXT_PUBLIC_CONTACT_EMAIL
      ? `mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}`
      : null,
    label: 'Написать нам' },
  { href: process.env.NEXT_PUBLIC_TELEGRAM_URL ?? null, label: 'Telegram' },
].filter((c): c is { href: string; label: string } => Boolean(c.href));

export function Footer() {
  return (
    <footer className="band bg-char text-cream">
      <div className="band-inner">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed opacity-70">
              Закрытый книжный клуб и трекер прочитанного. Читайте, отмечайте,
              обсуждайте с теми, кто читает рядом.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} className="space-y-3">
              <p className="text-xs uppercase tracking-widest opacity-50">
                {column.title}
              </p>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm opacity-80 underline-offset-4 hover:underline hover:opacity-100"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest opacity-50">Связь</p>
            {CONTACTS.length > 0 ? (
              <ul className="space-y-2">
                {CONTACTS.map((contact) => (
                  <li key={contact.label}>
                    <a
                      href={contact.href}
                      className="text-sm opacity-80 underline-offset-4 hover:underline hover:opacity-100"
                    >
                      {contact.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-relaxed opacity-60">
                Клуб пока закрытый: приглашение приходит от участников.
              </p>
            )}
          </div>
        </div>

        <p className="mt-12 text-xs opacity-45">
          Книжная полка, {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
