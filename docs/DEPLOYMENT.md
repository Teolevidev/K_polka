# Развёртывание «Книжной полки»

Пошаговая инструкция: от пустого репозитория до работающего сайта.
Время на всё — около 30–40 минут.

> Приложение собирается и запускается **даже без настроенного Supabase** —
> главная, поиск и страницы книг работают сразу (поиск ходит в Google Books
> и OpenLibrary). Авторизация, полки и статистика включатся после шага 2.

---

## 0. Локальный запуск (проверка)

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Открой http://localhost:3000 — должны работать главная, поиск книг и
страницы книг. Для входа и полок нужен Supabase (шаг 2).

---

## 1. Аккаунты, которые нужно создать

| Сервис | Зачем | Когда |
|--------|-------|-------|
| [GitHub](https://github.com) | Хранение кода | ✅ уже есть |
| [Supabase](https://supabase.com) | БД + авторизация | Шаг 2 |
| [Vercel](https://vercel.com) | Хостинг | Шаг 4 |
| [Google Cloud](https://console.cloud.google.com) | Вход через Google | Шаг 3 (опционально) |
| [Yandex Cloud](https://console.cloud.yandex.ru) | Email-рассылка (Postbox) | позже |

---

## 2. Supabase: база данных и авторизация

1. Создай проект на [supabase.com](https://supabase.com) (регион — ближайший, например Frankfurt).
2. Дождись инициализации (~2 минуты).
3. Открой **SQL Editor** → **New query**.
4. Скопируй содержимое `supabase/migrations/0001_init.sql`, вставь, нажми **Run**.
   Создадутся все таблицы, расширения поиска, RLS-политики и стартовые данные
   (жанры, достижения).
5. Открой **Project Settings → API** и скопируй:
   - `Project URL` → переменная `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` ключ → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` ключ → `SUPABASE_SERVICE_ROLE_KEY` (секретный!)
6. Открой **Project Settings → Database → Connection string** (режим *Session*),
   скопируй URI → `DATABASE_URL` (подставь свой пароль БД).
7. **Authentication → Providers → Email**: включи `Email`, включи
   `Confirm email` отключённым на старте необязательно — magic link работает и так.
8. **Authentication → URL Configuration**:
   - Site URL: твой будущий адрес на Vercel (или `http://localhost:3000` для теста)
   - Redirect URLs: добавь `http://localhost:3000/auth/callback` и
     `https://<твой-проект>.vercel.app/auth/callback`

---

## 3. Google OAuth (опционально, можно позже)

1. [Google Cloud Console](https://console.cloud.google.com) → создай проект.
2. **APIs & Services → Credentials → Create OAuth client ID** → тип *Web application*.
3. Authorized redirect URI: `https://<твой-проект>.supabase.co/auth/v1/callback`
4. Скопируй `Client ID` и `Client Secret`.
5. В Supabase: **Authentication → Providers → Google** → вставь Client ID и Secret, включи.

Apple OAuth настраивается аналогично, когда появится Apple Developer аккаунт.
Пока кнопка Apple скрыта флагом `NEXT_PUBLIC_FEATURE_APPLE_AUTH=false`.

---

## 4. Деплой на Vercel

1. Зайди на [vercel.com](https://vercel.com) через GitHub.
2. **Add New → Project** → выбери репозиторий `K_polka`.
3. Framework Preset определится автоматически (Next.js).
4. В разделе **Environment Variables** добавь все переменные из `.env.example`,
   которые ты заполнил (как минимум `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`).
5. **Deploy**. Через ~2 минуты сайт будет доступен на `https://<проект>.vercel.app`.
6. Вернись в Supabase → **Authentication → URL Configuration** и впиши
   реальный адрес Vercel в Site URL и Redirect URLs.

Каждый `git push` в `main` теперь автоматически деплоит обновление.
Pull request'ы получают отдельные preview-окружения.

---

## 5. Книжные API (опционально)

- **Google Books**: работает без ключа, но с лимитами. Для снятия лимитов
  получи ключ в Google Cloud (*APIs & Services → Library → Books API*) и
  задай `GOOGLE_BOOKS_API_KEY`.
- **OpenLibrary**: ключ не нужен.
- **ISBNdb**: платный, подключается в следующей итерации.

---

## Переменные окружения — минимум для продакшена

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...
NEXT_PUBLIC_APP_URL=https://<проект>.vercel.app
```

Остальные (email, YooKassa, ISBNdb) подключаются в Фазах 2–3.

---

## Частые проблемы

- **Сборка падает на шрифтах** — не наш случай: шрифты самохостятся через
  `@fontsource`, внешние запросы не нужны.
- **«Вход пока не подключён»** на `/signin` — не заданы переменные Supabase.
- **OAuth-редирект не туда** — проверь Redirect URLs в Supabase и точное
  совпадение с адресом Vercel.
