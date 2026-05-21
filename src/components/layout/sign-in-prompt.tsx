import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogoMark } from './logo';

interface SignInPromptProps {
  title: string;
  description: string;
  next?: string;
}

/** Заглушка для разделов, требующих входа в аккаунт. */
export function SignInPrompt({ title, description, next }: SignInPromptProps) {
  const href = next ? `/signin?next=${encodeURIComponent(next)}` : '/signin';
  return (
    <div className="container flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
      <LogoMark className="h-11 w-11 opacity-50" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="max-w-md text-muted-foreground">{description}</p>
      </div>
      <Button asChild>
        <Link href={href}>Войти в Книжную полку</Link>
      </Button>
    </div>
  );
}
