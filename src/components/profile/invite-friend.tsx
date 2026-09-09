'use client';

import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * «Пригласить друга» - копирует ссылку на клуб в буфер обмена.
 *
 * Полноценных приглашений по коду пока нет, а звать людей нужно уже
 * сейчас: клуб начинается с десятка знакомых, которым ссылку просто
 * пересылают в мессенджер.
 */
export function InviteFriend({ path = '/' }: { path?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // В некоторых браузерах доступ к буферу закрыт - тогда честно
      // показываем ссылку, чтобы человек скопировал ее руками.
      setFailed(true);
    }
  }

  return (
    <span className="inline-flex flex-col items-center gap-1">
      <Button size="sm" variant="outline" onClick={copy}>
        {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
        {copied ? 'Ссылка скопирована' : 'Пригласить друга'}
      </Button>
      {failed && (
        <span className="text-xs text-muted-foreground">
          Скопируйте адрес страницы из адресной строки
        </span>
      )}
    </span>
  );
}
