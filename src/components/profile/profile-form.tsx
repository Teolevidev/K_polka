'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { updateProfile, updatePassword } from '@/lib/profile/actions';
import type { ProfileRow, GenreOption } from '@/lib/profile/queries';

interface ProfileFormProps {
  profile: ProfileRow;
  genres: GenreOption[];
  email: string;
}

type GenderValue = 'male' | 'female' | 'other' | '';

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-1 block text-sm font-medium">{children}</label>
);

export function ProfileForm({ profile, genres, email }: ProfileFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // поля профиля
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [gender, setGender] = useState<GenderValue>(profile.gender ?? '');
  const [birthYear, setBirthYear] = useState(
    profile.birth_year ? String(profile.birth_year) : '',
  );
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(
    profile.favorite_genres ?? [],
  );

  // напоминания
  const [dailyReminder, setDailyReminder] = useState(profile.daily_reminder);
  const [reminderChannel, setReminderChannel] = useState(profile.reminder_channel);
  const [reminderTime, setReminderTime] = useState(
    (profile.reminder_time ?? '19:00').slice(0, 5),
  );
  const [telegramUsername, setTelegramUsername] = useState(
    profile.telegram_username ?? '',
  );

  // пароль
  const [password, setPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  function toggleGenre(slug: string) {
    setFavoriteGenres((prev) =>
      prev.includes(slug) ? prev.filter((g) => g !== slug) : [...prev, slug],
    );
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateProfile({
        displayName,
        username,
        bio,
        phone,
        gender,
        birthYear,
        favoriteGenres,
        dailyReminder,
        reminderChannel,
        reminderTime,
        telegramUsername,
      });
      if (!res.ok) {
        setError(res.error ?? 'Не удалось сохранить');
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  function savePassword() {
    setPasswordMsg(null);
    startTransition(async () => {
      const res = await updatePassword(password);
      setPasswordMsg(res.ok ? 'Пароль сохранён' : (res.error ?? 'Ошибка'));
      if (res.ok) setPassword('');
    });
  }

  return (
    <div className="space-y-8">
      {/* Основное */}
      <section className="space-y-4">
        <h2 className="font-serif text-lg font-semibold">Основное</h2>

        <div>
          <FieldLabel>Имя</FieldLabel>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Никнейм</FieldLabel>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="latinitsa_3-30"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Так вас увидят другие читатели
          </p>
        </div>
        <div>
          <FieldLabel>Электронная почта</FieldLabel>
          <Input value={email} disabled />
          <p className="mt-1 text-xs text-muted-foreground">
            Почта используется для входа и не меняется здесь
          </p>
        </div>
        <div>
          <FieldLabel>Телефон</FieldLabel>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 …"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Пол</FieldLabel>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as GenderValue)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Не указан</option>
              <option value="female">Женский</option>
              <option value="male">Мужской</option>
              <option value="other">Другой</option>
            </select>
          </div>
          <div>
            <FieldLabel>Год рождения</FieldLabel>
            <Input
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="1990"
            />
          </div>
        </div>
        <div>
          <FieldLabel>О себе</FieldLabel>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Пара слов о ваших читательских вкусах"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </section>

      {/* Любимые жанры */}
      <section className="space-y-3">
        <h2 className="font-serif text-lg font-semibold">Любимые жанры</h2>
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => {
            const active = favoriteGenres.includes(g.slug);
            return (
              <button
                key={g.slug}
                type="button"
                onClick={() => toggleGenre(g.slug)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-secondary',
                )}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Напоминания */}
      <section className="space-y-3">
        <h2 className="font-serif text-lg font-semibold">Напоминания о чтении</h2>
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={dailyReminder}
            onChange={(e) => setDailyReminder(e.target.checked)}
            className="size-4 accent-[hsl(var(--primary))]"
          />
          <span className="text-sm">Напоминать читать каждый день</span>
        </label>

        {dailyReminder && (
          <div className="space-y-3 rounded-md border border-border bg-secondary/40 p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Канал</FieldLabel>
                <select
                  value={reminderChannel}
                  onChange={(e) =>
                    setReminderChannel(e.target.value as 'email' | 'telegram')
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="email">Email</option>
                  <option value="telegram">Telegram</option>
                </select>
              </div>
              <div>
                <FieldLabel>Время</FieldLabel>
                <Input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                />
              </div>
            </div>
            {reminderChannel === 'telegram' && (
              <div>
                <FieldLabel>Telegram-аккаунт</FieldLabel>
                <Input
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                  placeholder="@username"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Доставка напоминаний в Telegram появится в ближайшем обновлении.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Сохранить профиль
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-primary">
            <Check className="size-4" /> Сохранено
          </span>
        )}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      {/* Пароль */}
      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="font-serif text-lg font-semibold">Пароль</h2>
        <p className="text-sm text-muted-foreground">
          Необязательно. Задайте пароль, чтобы входить не только по ссылке из письма.
        </p>
        <div className="flex gap-2">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Минимум 8 символов"
            className="max-w-xs"
          />
          <Button
            variant="outline"
            onClick={savePassword}
            disabled={pending || password.length < 8}
          >
            Задать пароль
          </Button>
        </div>
        {passwordMsg && <p className="text-sm text-muted-foreground">{passwordMsg}</p>}
      </section>
    </div>
  );
}
