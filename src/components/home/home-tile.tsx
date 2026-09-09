import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HomeTileProps {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Плитка на главной - светлая подложка внутри цветной ленты.
 *
 * Плитки стоят парами в сетке, поэтому тянутся на всю высоту ячейки:
 * иначе соседние блоки разной длины выглядят как ошибка верстки.
 */
export function HomeTile({ icon: Icon, title, children, className }: HomeTileProps) {
  return (
    <section
      className={cn(
        'flex h-full min-h-[260px] flex-col rounded-lg bg-background p-5 text-foreground shadow-lift sm:p-6',
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-5 shrink-0 text-accent" aria-hidden="true" />
        <h2 className="font-serif text-lg leading-snug sm:text-xl">{title}</h2>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}
