import { cn } from '@/lib/utils';
import { LeafPattern } from './leaf-pattern';

/**
 * Полноширинная лента-секция - главный структурный прием системы.
 *
 * Страница собирается из лент, уходящих в края экрана; смена цвета и
 * есть разделитель, поэтому никаких рамок и хайрлайнов между ними не
 * ставим. Две ленты одного цвета подряд не идут, а хроматических тонов
 * ровно два: зеленый и голубой, они чередуются через кремовый.
 */
export type BandTone = 'forest' | 'sky' | 'cream' | 'white' | 'char';

/**
 * Цвет ленты и текста на ней.
 *
 * Цветные ленты берут фирменные цвета напрямую: они одинаковы в обеих
 * темах, и текст на них подобран под конкретный фон. А кремовая - это
 * роль «светлая поверхность», а не конкретный цвет: ночью кремовая
 * плашка во весь экран слепит, поэтому она идет через семантический
 * токен и темнеет вместе со страницей.
 */
const TONES: Record<BandTone, string> = {
  forest: 'bg-forest text-cream',
  sky: 'bg-sky text-ink',
  cream: 'bg-secondary text-secondary-foreground',
  white: 'bg-background text-foreground',
  char: 'bg-char text-cream',
};

interface SectionBandProps {
  tone?: BandTone;
  className?: string;
  /** Якорь для ссылок из меню. */
  id?: string;
  /** Содержимое во всю ширину ленты, без ограничения в 1200px. */
  bleed?: boolean;
  children: React.ReactNode;
}

export function SectionBand({
  tone = 'white',
  className,
  id,
  bleed = false,
  children,
}: SectionBandProps) {
  // Паттерн - только на зеленых лентах: это брендовый акцент, а не
  // фон вообще всего. Прозрачность одна на всю систему и задана
  // переменной, чтобы менять ее в одном месте.
  const patterned = tone === 'forest';

  return (
    <section
      id={id}
      className={cn('band', TONES[tone], patterned && 'relative isolate', className)}
    >
      {patterned && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden text-cream"
          style={{ opacity: 'var(--pattern-opacity)' }}
        >
          <LeafPattern className="h-full w-full" />
        </div>
      )}
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
