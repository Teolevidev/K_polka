'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Upload, X, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from './avatar';
import { uploadAvatar, clearAvatar } from '@/lib/profile/avatar';

interface AvatarUploadProps {
  name: string;
  currentUrl: string | null;
}

/** Загрузка аватара с компьютера. Файл сохраняется в Supabase Storage. */
export function AvatarUpload({ name, currentUrl }: AvatarUploadProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSaved(false);

    // мгновенный превью
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    const fd = new FormData();
    fd.append('avatar', file);
    startTransition(async () => {
      const res = await uploadAvatar(fd);
      if (!res.ok) {
        setError(res.error ?? 'Не удалось загрузить');
        setPreview(currentUrl);
      } else {
        setPreview(res.url ?? null);
        setSaved(true);
        router.refresh();
      }
    });
  }

  function reset() {
    if (!confirm('Сбросить аватар?')) return;
    setError(null);
    startTransition(async () => {
      const res = await clearAvatar();
      if (!res.ok) setError(res.error ?? 'Ошибка');
      else {
        setPreview(null);
        if (fileRef.current) fileRef.current.value = '';
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Аватар</p>
      <div className="flex items-center gap-4">
        <Avatar name={name} src={preview} size="lg" />
        <div className="space-y-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onPick}
            className="hidden"
            id="avatar-file"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Загрузить фото
            </Button>
            {preview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={pending}
              >
                <X className="size-4" />
                Убрать
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            JPG/PNG/WEBP/GIF до 2 МБ
          </p>
        </div>
      </div>
      {saved && (
        <p className="inline-flex items-center gap-1 text-sm text-primary">
          <Check className="size-4" /> Аватар обновлён
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
