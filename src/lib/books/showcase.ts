import type { BookCardData } from '@/components/book/book-card';

/**
 * Витринные данные для главной страницы.
 *
 * ВРЕМЕННО: пока не подключена БД, главная показывает курируемый набор
 * известных книг. Обложки берутся из OpenLibrary по ISBN (при отсутствии —
 * аккуратный плейсхолдер). Клик ведёт в поиск по названию — пользователь
 * попадает на живые результаты из Google Books / OpenLibrary.
 *
 * В Фазе 2 эти секции заменят реальные данные: «Топ недели» из статистики
 * добавлений, «Что читают другие» из ленты активности и т.д.
 */

interface ShowcaseBook {
  title: string;
  author: string;
  isbn: string;
  rating: number;
}

function toCard(b: ShowcaseBook): BookCardData {
  return {
    title: b.title,
    authors: [b.author],
    coverUrl: `https://covers.openlibrary.org/b/isbn/${b.isbn}-M.jpg?default=false`,
    href: `/search?q=${encodeURIComponent(b.title)}`,
    rating: b.rating,
  };
}

const POPULAR: ShowcaseBook[] = [
  { title: 'Мастер и Маргарита', author: 'Михаил Булгаков', isbn: '9785699130870', rating: 9.2 },
  { title: '1984', author: 'Джордж Оруэлл', isbn: '9780451524935', rating: 9.0 },
  { title: 'Преступление и наказание', author: 'Фёдор Достоевский', isbn: '9780486415871', rating: 8.9 },
  { title: 'Норвежский лес', author: 'Харуки Мураками', isbn: '9780375704024', rating: 8.4 },
  { title: 'Маленький принц', author: 'Антуан де Сент-Экзюпери', isbn: '9780156012195', rating: 9.1 },
  { title: 'Сто лет одиночества', author: 'Габриэль Гарсиа Маркес', isbn: '9780060883287', rating: 8.8 },
  { title: 'Убить пересмешника', author: 'Харпер Ли', isbn: '9780061120084', rating: 8.9 },
  { title: 'Великий Гэтсби', author: 'Фрэнсис Скотт Фицджеральд', isbn: '9780743273565', rating: 8.3 },
];

const EDITORS_CHOICE: ShowcaseBook[] = [
  { title: 'Думай медленно, решай быстро', author: 'Даниэль Канеман', isbn: '9780374533557', rating: 8.7 },
  { title: 'Война и мир', author: 'Лев Толстой', isbn: '9781400079988', rating: 9.0 },
  { title: 'Властелин колец', author: 'Джон Р. Р. Толкин', isbn: '9780544003415', rating: 9.3 },
  { title: 'Гарри Поттер и философский камень', author: 'Дж. К. Роулинг', isbn: '9780747532699', rating: 9.0 },
  { title: 'Sapiens. Краткая история человечества', author: 'Юваль Ной Харари', isbn: '9780062316097', rating: 8.9 },
  { title: 'Цветы для Элджернона', author: 'Дэниел Киз', isbn: '9780156030304', rating: 9.1 },
  { title: 'Дюна', author: 'Фрэнк Герберт', isbn: '9780441013593', rating: 8.8 },
  { title: 'Над пропастью во ржи', author: 'Джером Сэлинджер', isbn: '9780316769488', rating: 8.0 },
];

export const showcaseSections = {
  popular: POPULAR.map(toCard),
  editorsChoice: EDITORS_CHOICE.map(toCard),
};
