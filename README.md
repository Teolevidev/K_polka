# Книжная полка

Веб-приложение для трекинга прочитанных книг с социальным слоем и закрытым книжным клубом по подписке.

## Статус

Фаза 1 — фундамент. Инициализация в процессе.

## Стек

- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript
- **Стили:** Tailwind CSS 4 + shadcn/ui
- **БД:** PostgreSQL (Supabase)
- **ORM:** Drizzle
- **Auth:** Supabase Auth (magic link + Google OAuth + Apple OAuth*)
- **i18n:** next-intl (RU/EN)
- **Поиск:** PostgreSQL `pg_trgm` + `unaccent` + `fuzzystrmatch` (fuzzy + опечатки)
- **Источники книг:** Google Books API, OpenLibrary API, ISBNdb, LiveLib (scraping)
- **Платежи:** YooKassa
- **Email:** Yandex Postbox
- **Хостинг:** Vercel + Supabase
- **Менеджер пакетов:** pnpm 9

\* Apple OAuth — за feature flag, активируется при наличии Apple Developer аккаунта.

## Документация

- [Технический дизайн-документ](./docs/design.md) — архитектура, схема БД, фичи по фазам, риски

## Локальная разработка

```bash
pnpm install
cp .env.example .env.local
# заполни .env.local своими ключами
pnpm dev
```

Откроется на http://localhost:3000

## Лицензия

Proprietary. © Teo, 2026.
