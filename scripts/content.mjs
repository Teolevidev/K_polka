#!/usr/bin/env node
/**
 * Контент-агент: постановка заданий и ручной прогон очереди.
 *
 * Скрипт намеренно тонкий. Вся логика - книги, промпты, проверки -
 * живет в приложении (src/lib/content), а здесь только два действия:
 * положить задания в очередь и попросить приложение их разгрести.
 * Иначе логика неизбежно разъедется на две копии, и та, что в скрипте,
 * тихо отстанет.
 *
 * Запуск (ключи берутся из .env.local):
 *
 *   # заводим книги по ISBN
 *   node --env-file=.env.local scripts/content.mjs books 9785171326135 9785389218383
 *
 *   # заводим книги списком из файла: строка «Название - Автор» или ISBN
 *   node --env-file=.env.local scripts/content.mjs books --file books.txt
 *
 *   # текстовые задания
 *   node --env-file=.env.local scripts/content.mjs review <id книги в каталоге>
 *   node --env-file=.env.local scripts/content.mjs longread "Зачем перечитывать"
 *   node --env-file=.env.local scripts/content.mjs roundup "Короткие книги на вечер"
 *
 *   # посмотреть очередь и разгрести ее
 *   node --env-file=.env.local scripts/content.mjs list
 *   node --env-file=.env.local scripts/content.mjs run 20
 *
 * Прогон идет через работающее приложение: по умолчанию
 * http://localhost:3000, иначе - адрес из CONTENT_AGENT_URL.
 * Значит, перед `run` нужен запущенный `pnpm dev` или `pnpm start`.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const [, , command, ...args] = process.argv;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.CONTENT_AGENT_URL ?? 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

function die(message) {
  console.error(message);
  process.exit(1);
}

function db() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    die(
      'Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.\n' +
        'Запускай с ключами: node --env-file=.env.local scripts/content.mjs ...',
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** ISBN - это 10 или 13 цифр, последняя у ISBN-10 может быть X. */
function looksLikeIsbn(value) {
  const digits = value.replace(/[\s-]/g, '');
  return /^\d{9}[\dXx]$/.test(digits) || /^\d{13}$/.test(digits);
}

/**
 * Разбирает строку списка книг.
 *
 * Понимает три вида: голый ISBN, «Название - Автор» и просто запрос.
 * Разделителем берем дефис с пробелами по краям: в названиях дефис
 * встречается («Жизнь и судьба», «Ай-Петри»), но почти всегда без
 * пробелов вокруг.
 */
function parseBookLine(line) {
  const value = line.trim();
  if (!value || value.startsWith('#')) return null;

  if (looksLikeIsbn(value)) {
    return { payload: { isbn: value.replace(/[\s-]/g, '') }, key: value.replace(/[\s-]/g, '') };
  }

  const parts = value.split(/\s+-\s+/);
  if (parts.length >= 2) {
    const title = parts[0].trim();
    const author = parts.slice(1).join(' - ').trim();
    return { payload: { title, author }, key: `${title}|${author}`.toLowerCase() };
  }

  return { payload: { query: value }, key: value.toLowerCase() };
}

async function enqueue(supabase, rows) {
  let queued = 0;
  let duplicates = 0;

  for (const row of rows) {
    const { error } = await supabase.from('content_jobs').insert({
      kind: row.kind,
      payload: row.payload,
      dedupe_key: row.dedupeKey ?? null,
    });
    if (!error) queued += 1;
    else if (error.code === '23505') duplicates += 1;
    else die(`Не удалось поставить задание: ${error.message}`);
  }

  console.log(
    `Поставлено заданий: ${queued}` +
      (duplicates > 0 ? `, пропущено повторов: ${duplicates}` : ''),
  );
}

async function commandBooks() {
  let lines = args;
  const fileFlag = args.indexOf('--file');
  if (fileFlag !== -1) {
    const path = args[fileFlag + 1];
    if (!path) die('После --file нужен путь к файлу');
    lines = readFileSync(path, 'utf8').split('\n');
  }

  const rows = lines
    .map(parseBookLine)
    .filter(Boolean)
    .map((parsed) => ({
      kind: 'ingest_book',
      payload: parsed.payload,
      dedupeKey: `ingest:${parsed.key}`,
    }));

  if (rows.length === 0) die('Нечего ставить: список книг пуст');
  await enqueue(db(), rows);
}

async function commandText(kind) {
  const value = args.join(' ').trim();
  if (!value) die(`Укажи аргумент: scripts/content.mjs ${kind} "..."`);

  const payload =
    kind === 'review'
      ? { bookId: value }
      : kind === 'longread'
        ? { topic: value }
        : { theme: value };

  // Рецензия на одну книгу нужна одна: ключ повтора держит это правило.
  const dedupeKey = kind === 'review' ? `review:${value}` : null;

  await enqueue(db(), [{ kind, payload, dedupeKey }]);
}

async function commandList() {
  const supabase = db();
  const { data, error } = await supabase
    .from('content_jobs')
    .select('id, kind, status, payload, result, error, attempts, created_at')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) die(`Не удалось прочитать очередь: ${error.message}`);

  if (!data || data.length === 0) {
    console.log('Очередь пуста');
    return;
  }

  const counts = {};
  for (const job of data) counts[job.status] = (counts[job.status] ?? 0) + 1;
  console.log(
    Object.entries(counts)
      .map(([status, n]) => `${status}: ${n}`)
      .join(', '),
  );
  console.log('');

  for (const job of data) {
    const what =
      job.result?.summary ??
      job.error ??
      JSON.stringify(job.payload).slice(0, 80);
    console.log(
      `${job.status.padEnd(9)} ${job.kind.padEnd(12)} ${what}` +
        (job.attempts > 1 ? `  (попыток: ${job.attempts})` : ''),
    );
  }
}

async function commandRun() {
  if (!CRON_SECRET) die('Нужен CRON_SECRET - тот же, что в окружении приложения');

  const limit = Number(args[0]) || 5;
  console.log(`Прогон очереди: до ${limit} заданий через ${APP_URL}`);

  // По одному заданию за запрос: так видно прогресс, и упавший запрос
  // не уносит с собой всю пачку.
  let done = 0;
  let failed = 0;
  for (let i = 0; i < limit; i += 1) {
    const res = await fetch(`${APP_URL}/api/cron/content?limit=1`, {
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });

    if (!res.ok) {
      die(`Приложение ответило ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const report = await res.json();
    if (report.processed === 0) {
      console.log('Очередь пуста - закончили');
      break;
    }

    for (const item of report.items ?? []) {
      if (item.ok) {
        done += 1;
        const warn = item.warnings?.length ? `  [${item.warnings.join(', ')}]` : '';
        console.log(`  ok    ${item.kind.padEnd(12)} ${item.summary}${warn}`);
      } else {
        failed += 1;
        console.log(`  ошибка ${item.kind.padEnd(11)} ${item.error}`);
      }
    }
  }

  console.log(`\nГотово: ${done} выполнено, ${failed} с ошибкой`);
}

const commands = {
  books: commandBooks,
  review: () => commandText('review'),
  longread: () => commandText('longread'),
  roundup: () => commandText('roundup'),
  list: commandList,
  run: commandRun,
};

const handler = commands[command];
if (!handler) {
  die(
    'Команды: books | review | longread | roundup | list | run\n' +
      'Подробности - в шапке scripts/content.mjs',
  );
}

await handler();
