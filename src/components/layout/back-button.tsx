'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * Кнопка «Назад».
 * Показывается на всех страницах, кроме главной. Возвращает на предыдущую
 * страницу; если истории нет (открыли по прямой ссылке) — ведёт на главную.
 */
export function BackButton() {
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
    <div className="container pt-3">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Вернуться назад"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Назад
      </button>
    </div>
  );
}
