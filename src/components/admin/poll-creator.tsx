'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus, X, Loader2, Vote, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createPoll, closePoll, type PollData } from '@/lib/polls';

interface PollCreatorProps {
  polls: PollData[];
}

const DATE_FMT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function PollCreator({ polls }: PollCreatorProps) {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setOption(i: number, v: string) {
    setOptions((prev) => prev.map((x, j) => (i === j ? v : x)));
  }

  function addOption() {
    if (options.length < 8) setOptions((prev) => [...prev, '']);
  }

  function removeOption(i: number) {
    if (options.length > 2) setOptions((prev) => prev.filter((_, j) => j !== i));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createPoll(question, options);
      if (!res.ok) setError(res.error ?? 'Ошибка');
      else {
        setQuestion('');
        setOptions(['', '']);
        router.refresh();
      }
    });
  }

  function close(id: string) {
    if (!confirm('Закрыть голосование?')) return;
    startTransition(async () => {
      const res = await closePoll(id);
      if (!res.ok) setError(res.error ?? 'Ошибка');
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Создание */}
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-serif text-lg font-semibold">Новый вопрос</h2>
        <div>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Вопрос для читателей"
          />
        </div>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Вариант ${i + 1}`}
              />
              {options.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOption(i)}
                  disabled={pending}
                  aria-label="Удалить вариант"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addOption} disabled={options.length >= 8}>
            <Plus className="size-4" />
            Добавить вариант
          </Button>
          <Button onClick={submit} disabled={pending} className="ml-auto">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Vote className="size-4" />}
            Создать
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>

      {/* Список */}
      <section>
        <h2 className="mb-2 font-serif text-lg font-semibold">
          Все голосовалки{' '}
          <span className="text-sm font-normal text-muted-foreground">
            ({polls.length})
          </span>
        </h2>
        {polls.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока ничего не создано.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {polls.map((p) => (
              <li key={p.id} className="p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">{p.question}</p>
                  <time className="text-xs text-muted-foreground">
                    {DATE_FMT.format(new Date(p.createdAt))}
                  </time>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.totalVotes} голос(ов) · {p.status === 'open' ? 'открыто' : 'закрыто'}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {p.options.map((o) => {
                    const pct = p.totalVotes > 0 ? Math.round((o.votes / p.totalVotes) * 100) : 0;
                    return (
                      <li key={o.id} className="flex items-center justify-between gap-2">
                        <span>{o.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {pct}% ({o.votes})
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {p.status === 'open' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => close(p.id)}
                    disabled={pending}
                    className="mt-2"
                  >
                    <XCircle className="size-4" /> Закрыть
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
