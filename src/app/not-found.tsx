import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/layout/logo';

export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <LogoMark className="h-12 w-12 opacity-40" />
      <h1 className="text-2xl font-bold">Страница не найдена</h1>
      <p className="max-w-sm text-muted-foreground">
        Возможно, книга переехала на другую полку или ссылка устарела.
      </p>
      <Button asChild>
        <Link href="/">На главную</Link>
      </Button>
    </div>
  );
}
