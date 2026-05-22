import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * OAuth / magic link callback.
 *
 * Поддерживает два формата ссылок Supabase:
 *  1. PKCE — в URL приходит ?code=… → exchangeCodeForSession()
 *  2. Token hash — приходит ?token_hash=…&type=… → verifyOtp()
 *     (этот формат надёжнее для писем: работает и при открытии
 *      ссылки на другом устройстве)
 *
 * После успеха пользователь отправляется на ?next=… (по умолчанию /profile).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') || '/profile';

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Не удалось подтвердить вход — возвращаем на страницу входа с пометкой
  return NextResponse.redirect(`${origin}/signin?error=auth`);
}
