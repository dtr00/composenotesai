import { cn } from "cn";

const GRID = 3;
const CELL = 3;
const GAP = 1;
const SIZE = GRID * CELL + (GRID - 1) * GAP;
const REPLACED_ICON_SIZE = 14;
const INSET = Math.floor((REPLACED_ICON_SIZE - SIZE) / 2);
const PERIOD_MS = 1400;
const BAYER_3X3 = [0, 7, 3, 6, 5, 2, 4, 1, 8];
const DITHER_SPREAD = 0.35;

const cells = Array.from({ length: GRID * GRID }, (_, index) => {
  const x = index % GRID;
  const y = Math.floor(index / GRID);
  const threshold = BAYER_3X3[index] / (GRID * GRID);
  const phase = (x + y) / (2 * (GRID - 1)) + threshold * DITHER_SPREAD;
  return { x, y, delay: -Math.round(phase * PERIOD_MS), resting: threshold < 0.5 };
});

interface DitherGlyphProps {
  label: string;
  className?: string;
}

export function DitherGlyph({ label, className }: DitherGlyphProps) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${REPLACED_ICON_SIZE} ${REPLACED_ICON_SIZE}`}
      shapeRendering="crispEdges"
      className={cn("size-3.5 shrink-0 text-foreground", className)}
    >
      {cells.map((cell) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={INSET + cell.x * (CELL + GAP)}
          y={INSET + cell.y * (CELL + GAP)}
          width={CELL}
          height={CELL}
          fill="currentColor"
          className={cn("animate-dither-cell motion-reduce:animate-none", !cell.resting && "motion-reduce:opacity-20")}
          style={{ animationDelay: `${cell.delay}ms` }}
        />
      ))}
    </svg>
  );
}
