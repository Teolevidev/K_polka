'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Target, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setReadingGoal } from '@/lib/shelf/actions';

interface GoalSetterProps {
  year: number;
  currentTarget: number | null;
}

/** Установка/изменение годовой цели по числу книг. */
export function GoalSetter({ year, currentTarget }: GoalSetterProps) {
  const router = useRouter();
  const [value, setValue] = useState(currentTarget ? String(currentTarget) : '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const target = Number(value);
    if (!Number.isInteger(target) || target < 1 || target > 1000) {
      setError('Введите число от 1 до 1000');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await setReadingGoal(target);
      if (!res.ok) setError(res.error ?? 'Не удалось сохранить');
      else router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Target className="size-5 text-primary" aria-hidden="true" />
        <h2 className="font-serif text-lg font-semibold">
          {currentTarget ? 'Изменить цель' : `Цель на ${year} год`}
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Сколько книг вы хотите прочитать в этом году?
      </p>
      <div className="mt-3 flex gap-2">
        <Input
          type="number"
          min={1}
          max={1000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="например, 24"
          className="max-w-[160px]"
        />
        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Сохранить
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
