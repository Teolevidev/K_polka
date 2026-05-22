import type { Metadata } from 'next';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SignInForm } from '@/components/auth/sign-in-form';
import { LogoMark } from '@/components/layout/logo';

export const metadata: Metadata = { title: 'Вход' };

interface SignInPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next = '/profile', error } = await searchParams;
  const appleEnabled = process.env.NEXT_PUBLIC_FEATURE_APPLE_AUTH === 'true';

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-10">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <LogoMark className="h-10 w-10" />
          <CardTitle className="text-xl">Вход в Книжную полку</CardTitle>
          <p className="text-sm text-muted-foreground">
            Войдите, чтобы вести свою библиотеку и ставить цели
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error === 'auth' && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>
                Не удалось завершить вход — ссылка устарела или уже использована.
                Запросите новую ссылку ниже.
              </span>
            </div>
          )}
          <SignInForm next={next} appleEnabled={appleEnabled} />
        </CardContent>
      </Card>
    </div>
  );
}
