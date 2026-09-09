import Link from 'next/link';
import { CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SourceUnavailableNoticeProps {
  /** Кто не ответил: «Google Books», «OpenLibrary». */
  source: string;
}

/**
 * Показывается, когда книга существует, но внешний источник не ответил.
 *
 * Отдельно от «Страница не найдена»: там ссылка битая и идти некуда,
 * а здесь достаточно вернуться позже, поэтому и текст другой.
 */
export function SourceUnavailableNotice({ source }: SourceUnavailableNoticeProps) {
  return (
    <div className="container flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <CloudOff className="size-10 text-muted-foreground/50" aria-hidden="true" />
      <div className="space-y-2">
        <h1 className="font-serif text-2xl font-semibold">
          Источник сейчас недоступен
        </h1>
        <p className="text-muted-foreground">
          {source} не ответил на запрос. Книга никуда не делась и ссылка рабочая —
          попробуйте обновить страницу через минуту.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link href="/search">К поиску</Link>
        </Button>
        <Button asChild>
          <Link href="/">На главную</Link>
        </Button>
      </div>
    </div>
  );
}
