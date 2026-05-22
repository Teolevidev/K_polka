import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '@/components/layout/providers';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { BackButton } from '@/components/layout/back-button';
// Самохостинг шрифтов (без внешних запросов к Google Fonts):
// надёжнее, быстрее и корректно работает для российской аудитории.
import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/lora/index.css';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Книжная полка — трекер прочитанных книг',
    template: '%s · Книжная полка',
  },
  description:
    'Ведите список прочитанного, ставьте цели, находите новые книги по названию, автору или ISBN и делитесь впечатлениями.',
  applicationName: 'Книжная полка',
  keywords: ['книги', 'трекер чтения', 'отзывы на книги', 'книжный клуб'],
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBFAF8' },
    { media: '(prefers-color-scheme: dark)', color: '#1C1A17' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <div className="flex min-h-dvh flex-col">
              <Header />
              <BackButton />
              <main className="flex-1 pb-20 md:pb-10">{children}</main>
              <BottomNav />
            </div>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
