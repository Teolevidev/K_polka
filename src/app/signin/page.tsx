import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SignInForm } from '@/components/auth/sign-in-form';
import { LogoMark } from '@/components/layout/logo';

export const metadata: Metadata = { title: 'Вход' };

interface SignInPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next = '/' } = await searchParams;
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
        <CardContent>
          <SignInForm next={next} appleEnabled={appleEnabled} />
        </CardContent>
      </Card>
    </div>
  );
}
