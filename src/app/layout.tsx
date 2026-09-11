import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '@/components/layout/providers';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Footer } from '@/components/layout/footer';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getCurrentUser } from '@/lib/supabase/server';
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
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b090b' },
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
  // Нижнее меню у гостя и участника разное, а рисуется оно в макете -
  // значит, и знать о входе должен макет.
  const signedIn = isSupabaseConfigured() ? Boolean(await getCurrentUser()) : false;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <div className="flex min-h-dvh flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
              <div className="pb-20 md:pb-0" />
              <BottomNav signedIn={signedIn} />
            </div>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
