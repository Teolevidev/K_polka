# Книжная полка

Веб-приложение для трекинга прочитанных книг с социальным слоем и закрытым
книжным клубом по подписке.

## Статус

**Фаза 1 — фундамент.** Готово: каркас приложения, главная в стиле Yandex Books,
поиск книг по Google Books + OpenLibrary (с устойчивостью к опечаткам в названии
и фамилии автора), страницы книг, светлая/тёмная темы, i18n (RU/EN), схема БД и
SQL-миграция для Supabase, инфраструктура авторизации (magic link + OAuth).
Продакшн-сборка проходит, юнит-тесты зелёные (20/20).

Дальше (Фаза 2): сохранение книг на полки, статистика чтения, цели и серии,
отзывы и рейтинги, профили пользователей.

## Стек

- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript
- **Стили:** Tailwind CSS 3 + дизайн-система с CSS-переменными
- **Шрифты:** самохостинг Inter + Lora (`@fontsource`)
- **БД:** PostgreSQL (Supabase) + Drizzle ORM
- **Auth:** Supabase Auth (magic link + Google OAuth + Apple OAuth*)
- **i18n:** next-intl (RU/EN)
- **Поиск:** Google Books + OpenLibrary API, fuzzy-ранжирование (Левенштейн);
  в БД — `pg_trgm` + `unaccent` + `fuzzystrmatch`
- **Платежи:** YooKassa (Фаза 3)
- **Email:** Yandex Postbox (Фаза 2)
- **Хостинг:** Vercel + Supabase
- **Пакетный менеджер:** pnpm 9

\* Apple OAuth — за feature flag, активируется при наличии Apple Developer.

## Документация

- [docs/design.md](./docs/design.md) — технический дизайн-документ
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — пошаговое развёртывание

## Локальная разработка

```bash
pnpm install
cp .env.example .env.local   # заполни своими ключами (см. DEPLOYMENT.md)
pnpm dev                     # http://localhost:3000
```

Приложение работает и без Supabase: главная, поиск и страницы книг доступны
сразу. Авторизация и полки включаются после настройки Supabase.

## Команды

```bash
pnpm dev         # дев-сервер
pnpm build       # продакшн-сборка
pnpm test        # юнит-тесты (Vitest)
pnpm typecheck   # проверка типов
pnpm lint        # ESLint
pnpm db:push     # применить схему Drizzle к БД
```

## Структура

```
src/
  app/            — маршруты (App Router)
  components/     — UI: book, home, layout, profile, auth, ui
  lib/
    books/        — поиск, нормализация, fuzzy, клиенты API
    supabase/     — клиенты Supabase (server/browser)
    db/           — подключение Drizzle
    i18n/         — конфигурация next-intl
  db/schema.ts    — схема БД (Drizzle)
  messages/       — переводы RU/EN
supabase/migrations/ — SQL-миграции (источник истины для БД)
```

## Лицензия

Proprietary. © Teo, 2026.
