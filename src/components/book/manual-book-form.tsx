'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { createBookManually, type ManualBookInput } from '@/lib/books/manual';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EMPTY: ManualBookInput = {
  title: '',
  authors: '',
  isbn: '',
  publishedYear: '',
  pageCount: '',
  description: '',
  coverUrl: '',
};

/** Форма ручного добавления книги в каталог. */
export function ManualBookForm() {
  const router = useRouter();
  const [values, setValues] = useState<ManualBookInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof ManualBookInput>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const result = await createBookManually(values);

    if (result.ok && result.ref) {
      router.push(`/book/${result.ref}`);
      return;
    }
    setError(result.error ?? 'Не удалось сохранить книгу');
    setSaving(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Название <span className="text-destructive">*</span>
        </label>
        <Input
          id="title"
          required
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Обелиск"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="authors" className="text-sm font-medium">
          Автор
        </label>
        <Input
          id="authors"
          value={values.authors}
          onChange={(e) => set('authors', e.target.value)}
          placeholder="Василь Быков"
        />
        <p className="text-xs text-muted-foreground">
          Несколько авторов перечислите через запятую
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="isbn" className="text-sm font-medium">
            ISBN
          </label>
          <Input
            id="isbn"
            inputMode="numeric"
            value={values.isbn}
            onChange={(e) => set('isbn', e.target.value)}
            placeholder="978-5-..."
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="year" className="text-sm font-medium">
            Год издания
          </label>
          <Input
            id="year"
            inputMode="numeric"
            value={values.publishedYear}
            onChange={(e) => set('publishedYear', e.target.value)}
            placeholder="1972"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="pages" className="text-sm font-medium">
            Страниц
          </label>
          <Input
            id="pages"
            inputMode="numeric"
            value={values.pageCount}
            onChange={(e) => set('pageCount', e.target.value)}
            placeholder="128"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="cover" className="text-sm font-medium">
          Ссылка на обложку
        </label>
        <Input
          id="cover"
          value={values.coverUrl}
          onChange={(e) => set('coverUrl', e.target.value)}
          placeholder="https://..."
        />
        <p className="text-xs text-muted-foreground">
          Необязательно. Без неё карточка покажет аккуратную заглушку.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          О чём книга
        </label>
        <textarea
          id="description"
          rows={4}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Пара предложений, чтобы участники понимали, о чём она"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Добавить в каталог
      </Button>
    </form>
  );
}
