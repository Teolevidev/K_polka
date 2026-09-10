'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Кнопка «Назад».
 *
 * Живет внутри шапки страницы, а не отдельной полосой над ней: полоса
 * на светлом фоне разрывала зеленую ленту ровно там, где та должна
 * начинаться.
 *
 * Возвращает на предыдущую страницу; если истории нет (открыли по
 * прямой ссылке) - ведет на главную.
 */
export function BackButton({ onBand = false }: { onBand?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  // На главной кнопка не нужна
  if (pathname === '/') return null;

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2 py-1 text-sm font-medium transition-colors',
        onBand
          ? 'text-cream/80 hover:text-cream'
          : 'text-muted-foreground hover:text-foreground',
      )}
      aria-label="Вернуться назад"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Назад
    </button>
  );
}
