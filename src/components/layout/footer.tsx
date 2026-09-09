import Link from 'next/link';
import { Logo } from './logo';

/**
 * Подвал - завершающая темная лента.
 *
 * В ритме секций это самая темная поверхность страницы: после нее
 * ничего нет, поэтому цвет плотнее любого другого фона.
 */
const COLUMNS = [
  {
    title: 'Читать',
    links: [
      { href: '/discover', label: 'Обзор книг' },
      { href: '/search', label: 'Поиск' },
      { href: '/library', label: 'Моя полка' },
      { href: '/book/new', label: 'Добавить книгу' },
    ],
  },
  {
    title: 'Клуб',
    links: [
      { href: '/blog', label: 'Блог' },
      { href: '/profile', label: 'Профиль' },
      { href: '/signin', label: 'Войти' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="band bg-char text-white">
      <div className="band-inner">
        <div className="grid gap-10 sm:grid-cols-[1.5fr_1fr_1fr]">
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
        </div>

        <p className="mt-12 text-xs opacity-45">
          Книжная полка, {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
