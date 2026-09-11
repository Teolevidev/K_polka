'use client';

import { cn } from '@/lib/utils';

/**
 * Сетка-индикатор: квадратики зажигаются по очереди, складываясь в
 * узор.
 *
 * Нужен там, где ожидание долгое и непредсказуемое: подбор книги у
 * AI-помощника, опрос трех каталогов в поиске. Крутящийся спиннер в
 * таких местах врет - он одинаков и на полсекунды, и на десять, а
 * сетка выглядит как процесс, у которого есть шаги.
 *
 * Анимация на CSS, без тика в JavaScript: браузер считает ее на
 * композиторе, и она не спорит с загрузкой страницы, ради которой все
 * и затевалось. При включенном «уменьшить движение» сетка замирает.
 */

export type GridPattern = 'wave' | 'ripple' | 'frame' | 'plus' | 'sparkle';

interface GridLoaderProps {
  /** Сторона сетки в клетках. */
  cells?: number;
  pattern?: GridPattern;
  /** Размер всей сетки в пикселях. */
  size?: number;
  /** Скругление клеток. */
  rounded?: boolean;
  className?: string;
}

/**
 * Фаза клетки: на каком шаге узора она загорается.
 * null - клетка в узоре не участвует и остается притушенной.
 */
function phaseOf(pattern: GridPattern, row: number, col: number, n: number): number | null {
  const last = n - 1;
  const mid = (n - 1) / 2;

  switch (pattern) {
    case 'wave':
      return col;

    case 'ripple':
      // Расстояние от центра по Чебышеву: кольца расходятся квадратами.
      return Math.max(Math.abs(row - mid), Math.abs(col - mid));

    case 'frame': {
      // Обход рамки по часовой стрелке, центр не участвует.
      const onEdge = row === 0 || col === 0 || row === last || col === last;
      if (!onEdge) return null;
      if (row === 0) return col;
      if (col === last) return last + row;
      if (row === last) return last * 2 + (last - col);
      return last * 3 + (last - row);
    }

    case 'plus':
      // Крест из центральной строки и столбца, углы притушены.
      if (row === mid || col === mid) {
        return Math.abs(row - mid) + Math.abs(col - mid);
      }
      return null;

    case 'sparkle':
    default: {
      // Детерминированный разброс: анимация одинакова при каждом
      // рендере, иначе сервер и клиент разойдутся на гидрации.
      const seed = (row * 7 + col * 13) % n;
      return seed;
    }
  }
}

export function GridLoader({
  cells = 3,
  pattern = 'ripple',
  size = 18,
  rounded = true,
  className,
}: GridLoaderProps) {
  const indices = Array.from({ length: cells * cells }, (_, i) => i);
  const phases = indices.map((i) =>
    phaseOf(pattern, Math.floor(i / cells), i % cells, cells),
  );
  const steps = Math.max(...phases.map((p) => p ?? 0)) + 1;
  const duration = 0.16 * steps + 0.5;

  return (
    <span
      className={cn('grid shrink-0', className)}
      style={{
        width: size,
        height: size,
        gridTemplateColumns: `repeat(${cells}, 1fr)`,
        gap: Math.max(1, Math.round(size / 14)),
      }}
      role="status"
      aria-label="Идет загрузка"
    >
      {indices.map((i) => {
        const phase = phases[i];
        return (
          <span
            key={i}
            className={cn('grid-loader-cell bg-current', rounded && 'rounded-[2px]')}
            style={{
              opacity: phase === null ? 0.18 : undefined,
              animationDuration: phase === null ? undefined : `${duration}s`,
              animationDelay:
                phase === null ? undefined : `${(phase / steps) * duration}s`,
            }}
          />
        );
      })}
    </span>
  );
}

interface LoadingPillProps {
  children: React.ReactNode;
  pattern?: GridPattern;
  className?: string;
}

/** Индикатор с подписью: «Подбираю книгу», «Ищу в каталогах». */
export function LoadingPill({ children, pattern = 'ripple', className }: LoadingPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5 rounded-pill bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
        className,
      )}
    >
      <GridLoader pattern={pattern} size={16} />
      {children}
    </span>
  );
}
