import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['ru', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ru';

export function isLocale(value: string | undefined): value is Locale {
  return value === 'ru' || value === 'en';
}

/**
 * Конфигурация next-intl в режиме «без i18n-роутинга».
 * Локаль берётся из cookie NEXT_LOCALE, по умолчанию — русский.
 * URL-префиксы /ru, /en добавим в Фазе 4 вместе с английскими переводами.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return { locale, messages };
});
