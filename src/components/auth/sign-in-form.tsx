'use client';

import { useState, type FormEvent } from 'react';
import { Mail, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Status = 'idle' | 'sending' | 'sent' | 'error';

interface SignInFormProps {
  /** Путь для возврата после входа. */
  next?: string;
  /** Включён ли вход через Apple (feature flag). */
  appleEnabled?: boolean;
}

export function SignInForm({ next = '/', appleEnabled = false }: SignInFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const configured = isSupabaseConfigured();

  const callbackUrl = `/auth/callback?next=${encodeURIComponent(next)}`;

  async function onMagicLink(e: FormEvent) {
    e.preventDefault();
    if (!configured) return;
    setStatus('sending');
    setMessage('');
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}${callbackUrl}`,
        },
      });
      if (error) throw error;
      setStatus('sent');
    } catch {
      setStatus('error');
      setMessage('Не удалось отправить ссылку. Попробуйте ещё раз.');
    }
  }

  async function onOAuth(provider: 'google' | 'apple') {
    if (!configured) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${callbackUrl}` },
    });
  }

  if (!configured) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/50 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-accent" />
        <div>
          <p className="font-medium">Вход пока не подключён</p>
          <p className="mt-1 text-muted-foreground">
            Чтобы включить авторизацию, задайте переменные{' '}
            <code className="rounded bg-background px-1">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
            и{' '}
            <code className="rounded bg-background px-1">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{' '}
            — см. файл .env.example и инструкцию по развёртыванию.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-secondary/50 p-6 text-center">
        <CheckCircle2 className="size-8 text-primary" />
        <div>
          <p className="font-medium">Ссылка отправлена</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Проверьте почту <span className="font-medium">{email}</span> и перейдите
            по ссылке для входа.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onMagicLink} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Электронная почта
          </label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <Button type="submit" className="w-full" disabled={status === 'sending'}>
          {status === 'sending' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Mail className="size-4" />
          )}
          Получить ссылку для входа
        </Button>
        {status === 'error' && (
          <p className="text-sm text-destructive">{message}</p>
        )}
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">или войдите через</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-2">
        <Button variant="outline" className="w-full" onClick={() => onOAuth('google')}>
          Google
        </Button>
        {appleEnabled && (
          <Button variant="outline" className="w-full" onClick={() => onOAuth('apple')}>
            Apple
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Входя, вы соглашаетесь с условиями использования и политикой
        конфиденциальности.
      </p>
    </div>
  );
}
