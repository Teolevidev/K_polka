import { BookOpen, Download, ExternalLink, ShoppingCart } from 'lucide-react';
import type { BookAvailability } from '@/lib/books/types';
import { Button } from '@/components/ui/button';

/** Цена в валюте, как ее вернул источник. */
function formatPrice(price: { amount: number; currency: string }): string {
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: price.currency,
      maximumFractionDigits: 0,
    }).format(price.amount);
  } catch {
    return `${price.amount} ${price.currency}`;
  }
}

const PREVIEW_TEXT: Record<BookAvailability['preview'], string> = {
  full: 'Книгу можно прочитать целиком',
  partial: 'Доступен фрагмент для чтения',
  none: 'Предпросмотра нет',
};

/**
 * Блок «Получить книгу».
 *
 * На сайте Google это отдельная вкладка, а в API - два блока ответа,
 * saleInfo и accessInfo, которые мы раньше не читали вовсе. Здесь
 * только то, что действительно можно сделать: если ни читать, ни
 * скачать, ни купить нельзя, блок не показывается.
 */
export function BookAvailabilityBlock({
  availability,
}: {
  availability: BookAvailability | null | undefined;
}) {
  if (!availability) return null;

  const { preview, publicDomain, epub, pdf, readerUrl, buyUrl, price } =
    availability;

  const hasAnything =
    Boolean(readerUrl) || Boolean(buyUrl) || epub || pdf || preview !== 'none';
  if (!hasAnything) return null;

  const formats = [epub && 'EPUB', pdf && 'PDF'].filter(Boolean) as string[];

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Получить книгу</h2>

      <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-4">
        <p className="text-sm">
          {PREVIEW_TEXT[preview]}
          {publicDomain && ' - книга в общественном достоянии'}
          {formats.length > 0 && ` - ${formats.join(', ')}`}
        </p>

        <div className="flex flex-wrap gap-2">
          {readerUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={readerUrl} target="_blank" rel="noreferrer noopener">
                <BookOpen className="size-4" aria-hidden="true" />
                {preview === 'full' ? 'Читать' : 'Смотреть фрагмент'}
              </a>
            </Button>
          )}

          {publicDomain && (epub || pdf) && readerUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={readerUrl} target="_blank" rel="noreferrer noopener">
                <Download className="size-4" aria-hidden="true" />
                Скачать
              </a>
            </Button>
          )}

          {buyUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={buyUrl} target="_blank" rel="noreferrer noopener">
                <ShoppingCart className="size-4" aria-hidden="true" />
                {price ? `Купить за ${formatPrice(price)}` : 'Купить'}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
