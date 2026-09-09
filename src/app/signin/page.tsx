import type { Metadata } from 'next';
import { AlertCircle } from 'lucide-react';
import { SignInForm } from '@/components/auth/sign-in-form';
import { LogoMark } from '@/components/layout/logo';
import { SectionBand } from '@/components/layout/section-band';
import { FAILURE_MESSAGES, parseFailure } from '@/lib/auth/failure';

export const metadata: Metadata = { title: 'Вход' };

interface SignInPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next = '/profile', error } = await searchParams;
  const appleEnabled = process.env.NEXT_PUBLIC_FEATURE_APPLE_AUTH === 'true';
  const failure = parseFailure(error);

  return (
    <SectionBand tone="forest" className="min-h-[75vh]">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <LogoMark className="h-11 w-11" />

        <h1 className="text-display-sm mt-6 text-center font-serif">
          Вход в Книжную полку
        </h1>
        <p className="mt-4 text-center text-base opacity-80">
          Войдите, чтобы вести свою библиотеку, ставить цели и обсуждать
          прочитанное.
        </p>

        {/* Форма живет на светлой подложке: поля ввода на плотном зеленом
            читаются плохо, а лента остается брендовым фоном. */}
        <div className="mt-8 w-full rounded-lg bg-background p-6 text-foreground shadow-lift sm:p-7">
          {failure && (
            <div className="mb-5 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm">
              <AlertCircle
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <span>{FAILURE_MESSAGES[failure]}</span>
            </div>
          )}
          <SignInForm next={next} appleEnabled={appleEnabled} />
        </div>
      </div>
    </SectionBand>
  );
}
