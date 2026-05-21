import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Google Books обложки
      { protocol: 'https', hostname: 'books.google.com' },
      { protocol: 'http', hostname: 'books.google.com' },
      // OpenLibrary обложки
      { protocol: 'https', hostname: 'covers.openlibrary.org' },
      // Bookmate / Yandex Books обложки (референс/импорт)
      { protocol: 'https', hostname: 'api.bookmate.ru' },
      // Supabase Storage (аватары, кастомные обложки)
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  experimental: {
    // Серверные экшены — основной способ мутаций
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default withNextIntl(nextConfig);
