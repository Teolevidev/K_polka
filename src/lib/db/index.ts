import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

/**
 * Drizzle-клиент БД для прямых запросов (агрегаты, фоновые задачи).
 *
 * Для пользовательских операций предпочтительнее Supabase-клиент с RLS.
 * Этот клиент использует прямое подключение к Postgres и применяется
 * там, где нужны сложные SQL-запросы или сервисные операции.
 */

const connectionString = process.env.DATABASE_URL;

// Singleton — чтобы dev-режим не плодил подключения при HMR
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

function createClient() {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL не задан. Подключение к БД недоступно — см. .env.example',
    );
  }
  return postgres(connectionString, { prepare: false, max: 5 });
}

export const pgClient = globalForDb.pgClient ?? createClientSafe();

function createClientSafe() {
  try {
    const client = createClient();
    if (process.env.NODE_ENV !== 'production') {
      globalForDb.pgClient = client;
    }
    return client;
  } catch {
    // БД не настроена — вернём заглушку; обращение к ней бросит ошибку явно
    return undefined as unknown as ReturnType<typeof postgres>;
  }
}

export const db = pgClient
  ? drizzle(pgClient, { schema })
  : (undefined as unknown as ReturnType<typeof drizzle<typeof schema>>);

export { schema };
