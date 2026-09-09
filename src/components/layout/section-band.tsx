import { cn } from '@/lib/utils';

/**
 * Полноширинная лента-секция - главный структурный прием системы.
 *
 * Страница собирается из лент, уходящих в края экрана; смена цвета и
 * есть разделитель, поэтому никаких рамок и хайрлайнов между ними не
 * ставим. Две ленты одного цвета подряд не идут, а хроматических тонов
 * ровно два: зеленый и голубой, они чередуются через кремовый.
 */
export type BandTone = 'forest' | 'sky' | 'cream' | 'white' | 'char';

const TONES: Record<BandTone, string> = {
  forest: 'bg-forest text-white',
  sky: 'bg-sky text-ink',
  cream: 'bg-cream text-ink',
  white: 'bg-background text-foreground',
  char: 'bg-char text-white',
};

interface SectionBandProps {
  tone?: BandTone;
  className?: string;
  /** Содержимое во всю ширину ленты, без ограничения в 1200px. */
  bleed?: boolean;
  children: React.ReactNode;
}

export function SectionBand({
  tone = 'white',
  className,
  bleed = false,
  children,
}: SectionBandProps) {
  return (
    <section className={cn('band', TONES[tone], className)}>
      {bleed ? children : <div className="band-inner">{children}</div>}
    </section>
  );
}

/**
 * Заголовок ленты. На цветных лентах текст белый или чернильный - его
 * задает сама лента, поэтому цвет здесь не назначаем.
 */
export function BandHeading({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <h2 className="font-serif text-2xl leading-tight sm:text-3xl">{title}</h2>
      {subtitle && <p className="text-sm opacity-70 sm:text-base">{subtitle}</p>}
    </div>
  );
}
