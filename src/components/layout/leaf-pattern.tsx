/**
 * Фоновый узор зеленых лент.
 *
 * Без тайлинга. Первая версия собиралась из плитки через <pattern>, и
 * это было ошибкой: SVG обрезает содержимое плитки по ее границам, из-за
 * чего крупные формы получали прямые срезы, а стыки читались ровной
 * сеткой вертикальных линий.
 *
 * Здесь несколько очень крупных форм разложены по одному холсту и
 * намеренно уходят за края: в кадр попадают их куски, а не фигуры
 * целиком - именно это и делает узор фоном, а не набором картинок.
 * Прямых линий нет вовсе, только дуги.
 *
 * Цвет наследуется от ленты (currentColor), прозрачность задана
 * переменной --pattern-opacity в globals.css.
 */

const VIEW_W = 1440;
const VIEW_H = 720;

/** Овал: cx, cy, радиусы и наклон. */
const BLOBS: { cx: number; cy: number; rx: number; ry: number; rotate: number }[] = [
  { cx: 210, cy: 40, rx: 430, ry: 520, rotate: -14 },
  { cx: 900, cy: -120, rx: 520, ry: 420, rotate: 10 },
  { cx: 1360, cy: 620, rx: 420, ry: 500, rotate: -6 },
];

export function LeafPattern({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {BLOBS.map((b, i) => (
        <ellipse
          key={i}
          cx={b.cx}
          cy={b.cy}
          rx={b.rx}
          ry={b.ry}
          fill="currentColor"
          transform={`rotate(${b.rotate} ${b.cx} ${b.cy})`}
        />
      ))}
    </svg>
  );
}
