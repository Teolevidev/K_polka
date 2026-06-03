'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Save, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { saveArticle, deleteArticle } from '@/lib/articles/actions';
import type { ArticleKind, ArticleStatus, ArticleRow } from '@/lib/articles/queries';

interface ArticleEditorProps {
  initial?: ArticleRow;
}

const KINDS: { id: ArticleKind; label: string }[] = [
  { id: 'editorial', label: 'Колонка редактора' },
  { id: 'review', label: 'Обзор книги' },
  { id: 'other', label: 'Другое' },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ё]/g, 'е')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9а-я]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const Lbl = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-1 block text-sm font-medium">{children}</label>
);

export function ArticleEditor({ initial }: ArticleEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [kind, setKind] = useState<ArticleKind>(initial?.kind ?? 'editorial');
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '');
  const [bodyMd, setBodyMd] = useState(initial?.bodyMd ?? '');
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? '');
  const [relatedBookRef, setRelatedBookRef] = useState(
    initial?.relatedBookRef ?? '',
  );
  const [status, setStatus] = useState<ArticleStatus>(
    initial?.status ?? 'draft',
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function autoSlug() {
    if (!slug.trim() && title.trim()) setSlug(slugify(title));
  }

  function save(nextStatus: ArticleStatus) {
    setError(null);
    startTransition(async () => {
      const res = await saveArticle({
        id: initial?.id,
        slug,
        title,
        excerpt,
        bodyMd,
        coverUrl,
        kind,
        status: nextStatus,
        relatedBookRef,
      });
      if (!res.ok) setError(res.error ?? 'Ошибка');
      else {
        setStatus(nextStatus);
        if (!initial) router.push(`/blog/${res.slug}`);
        else router.refresh();
      }
    });
  }

  function remove() {
    if (!initial?.id) return;
    if (!confirm('Удалить статью без возможности восстановления?')) return;
    startTransition(async () => {
      const res = await deleteArticle(initial.id);
      if (!res.ok) setError(res.error ?? 'Ошибка');
      else router.push('/admin/articles');
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Lbl>Заголовок</Lbl>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={autoSlug} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Lbl>Slug в URL</Lbl>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="kak-chitat-tolstogo"
          />
        </div>
        <div>
          <Lbl>Тип</Lbl>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ArticleKind)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Lbl>Короткое описание (анонс)</Lbl>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          maxLength={300}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <Lbl>Обложка (URL изображения)</Lbl>
        <Input
          type="url"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>

      <div>
        <Lbl>Связанная книга (book_ref, опционально)</Lbl>
        <Input
          value={relatedBookRef}
          onChange={(e) => setRelatedBookRef(e.target.value)}
          placeholder="скопируйте из URL книги после /book/"
        />
      </div>

      <div>
        <Lbl>Текст статьи (поддерживаются переносы строк)</Lbl>
        <textarea
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
          rows={14}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
        />
      </div>

      <div className={cn(
        'flex flex-wrap items-center gap-2',
        'rounded-md border border-border bg-secondary/30 p-3',
      )}>
        <span className="text-sm text-muted-foreground">
          Статус: {status === 'published' ? 'опубликована' : 'черновик'}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => save('draft')} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Сохранить черновик
          </Button>
          <Button onClick={() => save('published')} disabled={pending}>
            <Eye className="size-4" /> Опубликовать
          </Button>
          {initial && (
            <Button variant="ghost" onClick={remove} disabled={pending}>
              <Trash2 className="size-4" />
              Удалить
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
