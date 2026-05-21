'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

/** Кнопка выхода из аккаунта. */
export function SignOutButton() {
  const router = useRouter();

  async function onSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={onSignOut}>
      <LogOut className="size-4" />
      Выйти
    </Button>
  );
}
