/**
 * Фоновый паттерн зеленых лент - крупные лепестки.
 *
 * Форма одна: четверть круга с прямым углом и скругленной внешней
 * кромкой. Разные повороты и размеры дают ощущение растительного
 * орнамента, не превращая его в узнаваемый рисунок - фон не должен
 * спорить с текстом поверх.
 *
 * Цвет наследуется от ленты (currentColor), прозрачность задана
 * переменной --pattern-opacity в globals.css.
 */

/** Четверть круга радиуса r: прямой угол в начале координат. */
function petal(r: number): string {
  return `M0,0 L${r},0 A${r},${r} 0 0,1 0,${r} Z`;
}

const TILE = 420;

/** Лепестки внутри одной плитки: сдвиг, поворот и радиус. */
const LEAVES: { x: number; y: number; rotate: number; r: number }[] = [
  { x: -40, y: -60, rotate: 12, r: 240 },
  { x: 300, y: 40, rotate: 160, r: 180 },
  { x: 90, y: 250, rotate: 255, r: 200 },
  { x: 380, y: 300, rotate: 70, r: 150 },
];

export function LeafPattern({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern
          id="leaf-pattern"
          width={TILE}
          height={TILE}
          patternUnits="userSpaceOnUse"
        >
          {LEAVES.map((leaf, i) => (
            <path
              key={i}
              d={petal(leaf.r)}
              fill="currentColor"
              transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.rotate})`}
            />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#leaf-pattern)" />
    </svg>
  );
}
