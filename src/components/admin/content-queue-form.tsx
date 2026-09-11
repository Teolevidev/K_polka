'use client';

import { useState, useTransition } from 'react';
import { BookPlus, PenLine, Loader2 } from 'lucide-react';
import { queueBooks, queueText } from '@/lib/content/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Постановка заданий агенту.
 *
 * Два поля вместо конструктора с выбором типа: книги ставятся списком
 * и десятками, тексты - по одному и осмысленно. Складывать это в одну
 * форму значит мешать два разных действия.
 */

type TextKind = 'review' | 'longread' | 'roundup';

const TEXT_KINDS: { id: TextKind; label: string; placeholder: string }[] = [
  {
    id: 'review',
    label: 'Рецензия',
    placeholder: 'id книги из каталога',
  },
  {
    id: 'longread',
    label: 'Лонгрид',
    placeholder: 'тема: «Зачем перечитывать книги»',
  },
  {
    id: 'roundup',
    label: 'Подборка',
    placeholder: 'тема: «Короткие книги на один вечер»',
  },
];

export function ContentQueueForm() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BooksForm />
      <TextForm />
    </div>
  );
}

function BooksForm() {
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await queueBooks(value);
      if (res.ok) {
        setMessage(res.message ?? 'Готово');
        setValue('');
      } else {
        setError(res.error ?? 'Не вышло');
      }
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-medium">
        <BookPlus className="size-4 text-primary" aria-hidden="true" />
        Книги в каталог
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        По книге на строку. Понимает ISBN, «Название - Автор» или просто
        запрос. Строки с решеткой пропускаются.
      </p>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={7}
        spellCheck={false}
        placeholder={'9785171326135\nЛавр - Евгений Водолазкин\n# это комментарий'}
        className="mt-3 w-full rounded-md border border-input bg-background p-3 font-mono text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={pending || !value.trim()} size="sm">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Поставить в очередь
        </Button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </section>
  );
}

function TextForm() {
  const [kind, setKind] = useState<TextKind>('review');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const active = TEXT_KINDS.find((k) => k.id === kind)!;

  function submit() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await queueText(kind, value);
      if (res.ok) {
        setMessage(res.message ?? 'Готово');
        setValue('');
      } else {
        setError(res.error ?? 'Не вышло');
      }
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-medium">
        <PenLine className="size-4 text-primary" aria-hidden="true" />
        Текст
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Придет черновиком в раздел «Статьи». Опубликовать может только человек.
      </p>

      <div className="mt-3 flex flex-wrap gap-1">
        {TEXT_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={
              'rounded-full border px-3 py-1 text-sm transition-colors ' +
              (kind === k.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-secondary')
            }
          >
            {k.label}
          </button>
        ))}
      </div>

      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={active.placeholder}
        className="mt-3"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={pending || !value.trim()} size="sm">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Поставить в очередь
        </Button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </section>
  );
}
