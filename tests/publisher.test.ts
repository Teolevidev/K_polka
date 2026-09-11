import { describe, it, expect } from 'vitest';
import {
  parsePublisherPage,
  extractJsonLd,
  extractMeta,
  readPublishedYear,
  isKnownPublisherHost,
  publisherNameByUrl,
  PublisherMarkupError,
} from '@/lib/books/publisher';

/**
 * Тесты разбора страниц издательств.
 *
 * Разметка здесь синтетическая, и это честная граница теста: он
 * проверяет ЛОГИКУ разбора - все формы, в которых schema.org встречается
 * в природе, - но не проверяет, что конкретный сайт размечен именно так.
 * Второе проверяется только на живой странице, и до нее этот код еще не
 * доходил.
 *
 * Формы взяты не с потолка: @graph, массив в корне, @type массивом,
 * author то строкой, то объектом Person, несколько блоков JSON-LD на
 * странице - все это разные способы сказать одно и то же, и разметчики
 * пользуются всеми.
 */

const URL_AST = 'https://ast.ru/book/samyy-bogatyy-chelovek-v-vavilone-894062/';

/** Карточка с полным JSON-LD типа Book - самый удобный случай. */
const PAGE_BOOK = `
<html><head>
<meta property="og:title" content="Лавр - купить книгу | Издательство АСТ">
<meta property="og:image" content="/upload/cover-894062.jpg">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Book",
  "name": "Лавр",
  "author": { "@type": "Person", "name": "Евгений Водолазкин" },
  "isbn": "978-5-17-132613-5",
  "numberOfPages": "440",
  "datePublished": "2023-05-01",
  "inLanguage": "ru",
  "publisher": { "@type": "Organization", "name": "Редакция Елены Шубиной" },
  "description": "Роман о средневековом враче <b>Арсении</b>",
  "image": "https://ast.ru/upload/cover-894062.jpg"
}
</script>
</head><body></body></html>`;

/** Тот же товар, но размечен как Product внутри @graph, без типа Book. */
const PAGE_PRODUCT_GRAPH = `
<html><head>
<meta property="og:title" content="Сад | Марина Степнова">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "BreadcrumbList", "itemListElement": [] },
    {
      "@type": ["Product", "Offer"],
      "name": "Сад",
      "author": "Марина Степнова",
      "isbn": "9785171225469",
      "description": "Роман о девочке, выросшей в саду",
      "image": "https://www.ast.ru/img/sad.jpg"
    }
  ]
}
</script>
</head><body></body></html>`;

/** Разметки нет вовсе - только og-теги. */
const PAGE_OG_ONLY = `
<html><head>
<meta property="og:title" content="Чагин &mdash; купить книгу">
<meta property="og:description" content="Новый роман Евгения Водолазкина">
<meta property="og:image" content="https://ast.ru/img/chagin.jpg">
</head><body></body></html>`;

/** Совсем пусто. */
const PAGE_EMPTY = '<html><head><title>Ошибка 404</title></head><body></body></html>';

describe('реестр издательств', () => {
  it('узнает известные хосты, в том числе с www', () => {
    expect(isKnownPublisherHost('https://ast.ru/book/x/')).toBe(true);
    expect(isKnownPublisherHost('https://www.eksmo.ru/book/y/')).toBe(true);
    expect(publisherNameByUrl('https://azbooka.ru/z')).toBe('Азбука');
  });

  it('не принимает чужие сайты и мусор', () => {
    expect(isKnownPublisherHost('https://example.com/book')).toBe(false);
    expect(isKnownPublisherHost('не адрес')).toBe(false);
  });
});

describe('извлечение разметки', () => {
  it('собирает все блоки JSON-LD, включая вложенные в @graph', () => {
    expect(extractJsonLd(PAGE_PRODUCT_GRAPH).length).toBeGreaterThanOrEqual(3);
  });

  it('переживает битый JSON-LD и не роняет остальное', () => {
    const html = `
      <script type="application/ld+json">{ это не json }</script>
      <script type="application/ld+json">{"@type":"Book","name":"Лавр"}</script>`;
    const nodes = extractJsonLd(html);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe('Лавр');
  });

  it('читает и property, и name у метатегов, декодируя сущности', () => {
    const meta = extractMeta(
      '<meta property="og:title" content="&laquo;Лавр&raquo;"><meta name="description" content="A &amp; B">',
    );
    expect(meta['og:title']).toBe('«Лавр»');
    expect(meta['description']).toBe('A & B');
  });

  it('вытаскивает год из даты любой формы', () => {
    expect(readPublishedYear('2023-05-01')).toBe('2023');
    expect(readPublishedYear('01.05.2023')).toBe('2023');
    expect(readPublishedYear('2023')).toBe('2023');
    expect(readPublishedYear('без даты')).toBeNull();
  });
});

describe('разбор карточки книги', () => {
  it('собирает полную карточку из JSON-LD типа Book', () => {
    const book = parsePublisherPage(PAGE_BOOK, URL_AST);

    expect(book.source).toBe('publisher');
    expect(book.title).toBe('Лавр');
    expect(book.authors).toEqual(['Евгений Водолазкин']);
    expect(book.isbn13).toBe('9785171326135');
    expect(book.pageCount).toBe(440);
    expect(book.publishedDate).toBe('2023');
    expect(book.publisher).toBe('Редакция Елены Шубиной');
    expect(book.language).toBe('ru');
    expect(book.sourceUrl).toBe(URL_AST);
  });

  it('чистит аннотацию от html-разметки', () => {
    const book = parsePublisherPage(PAGE_BOOK, URL_AST);
    expect(book.description).toBe('Роман о средневековом враче Арсении');
  });

  it('берет название из JSON-LD, а не из замусоренного og:title', () => {
    // og:title здесь - «Лавр - купить книгу | Издательство АСТ».
    expect(parsePublisherPage(PAGE_BOOK, URL_AST).title).toBe('Лавр');
  });

  it('работает с Product внутри @graph и с @type массивом', () => {
    const book = parsePublisherPage(PAGE_PRODUCT_GRAPH, URL_AST);
    expect(book.title).toBe('Сад');
    expect(book.authors).toEqual(['Марина Степнова']);
    expect(book.isbn13).toBe('9785171225469');
  });

  it('обходится одними og-тегами, когда JSON-LD нет', () => {
    const book = parsePublisherPage(PAGE_OG_ONLY, URL_AST);
    // Хвост «- купить книгу» из заголовка убран.
    expect(book.title).toBe('Чагин');
    expect(book.description).toBe('Новый роман Евгения Водолазкина');
    expect(book.coverUrl).toBe('https://ast.ru/img/chagin.jpg');
    // Издательство подставлено по хосту - на странице его не было.
    expect(book.publisher).toBe('АСТ');
  });

  it('чистит все варианты торгового хвоста в заголовке', () => {
    // Граница слова после кириллицы - место, где \b в JavaScript не
    // работает, а выражение при этом выглядит правильным.
    for (const tail of ['купить книгу', 'читать онлайн', 'скачать', 'заказать']) {
      const html = PAGE_OG_ONLY.replace('купить книгу', tail);
      expect(parsePublisherPage(html, URL_AST).title).toBe('Чагин');
    }
  });

  it('не режет заголовок, в котором дефис часть названия', () => {
    const html = PAGE_OG_ONLY.replace(
      'Чагин &mdash; купить книгу',
      'Аэропорт-2',
    );
    expect(parsePublisherPage(html, URL_AST).title).toBe('Аэропорт-2');
  });

  it('делает относительный адрес обложки абсолютным', () => {
    const html = PAGE_OG_ONLY.replace(
      'https://ast.ru/img/chagin.jpg',
      '/img/chagin.jpg',
    );
    expect(parsePublisherPage(html, URL_AST).coverUrl).toBe(
      'https://ast.ru/img/chagin.jpg',
    );
  });

  it('падает внятно, когда разметки нет совсем', () => {
    // Молчаливый пропуск здесь хуже ошибки: книга не завелась бы, и
    // никто бы не понял почему.
    expect(() => parsePublisherPage(PAGE_EMPTY, URL_AST)).toThrow(
      PublisherMarkupError,
    );
  });

  it('не выдумывает поля, которых на странице нет', () => {
    const book = parsePublisherPage(PAGE_OG_ONLY, URL_AST);
    expect(book.isbn13).toBeNull();
    expect(book.pageCount).toBeNull();
    expect(book.publishedDate).toBeNull();
    expect(book.authors).toEqual([]);
  });
});
