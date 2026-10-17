import { createLucideIcon, type LucideIconNode } from "lucide-react";

const CELL = 3;
const ORIGIN = 3;
const PATTERN = ["#####.", "##.#.#", "#.#.#.", ".#.#..", "#.#.#.", ".#...."];

const cells: LucideIconNode[] = PATTERN.flatMap((row, y) =>
  [...row].flatMap((cell, x): LucideIconNode[] =>
    cell === "#"
      ? [
          [
            "rect",
            {
              key: `${x}-${y}`,
              x: ORIGIN + x * CELL,
              y: ORIGIN + y * CELL,
              width: CELL,
              height: CELL,
              fill: "currentColor",
              stroke: "none",
            },
          ],
        ]
      : [],
  ),
);

export const DitherIcon = createLucideIcon("dither", cells);
