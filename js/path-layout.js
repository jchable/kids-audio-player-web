/* Calcule la position des étapes du chemin. La taille d'une étape ne dépend jamais de leur nombre. */

export const STEP_SIZE = 112;
export const CURRENT_SIZE = 128;

const TABLET_WIDTH = 600;
const CELL_WIDTH = 170;
const FIRST_Y = 84;
const ROW_HEIGHT = 190;
const BOTTOM_ROOM = 48;

function zigzag(count, width) {
  const left = width * 0.28;
  const right = width * 0.72;
  return Array.from({ length: count }, (_, i) => ({
    x: i % 2 === 0 ? left : right,
    y: FIRST_Y + i * ROW_HEIGHT,
    row: i,
  }));
}

function serpentine(count, width) {
  const columns = Math.floor(width / CELL_WIDTH);
  const cell = width / columns;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / columns);
    const position = i % columns;
    const column = row % 2 === 0 ? position : columns - 1 - position;
    return { x: (column + 0.5) * cell, y: FIRST_Y + row * ROW_HEIGHT, row };
  });
}

export function pathLayout(count, width) {
  const points = width < TABLET_WIDTH ? zigzag(count, width) : serpentine(count, width);
  const last = points[points.length - 1];
  return { points, height: last ? last.y + CURRENT_SIZE / 2 + BOTTOM_ROOM : 0 };
}

export function pathD(points) {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  let d = `M${first.x} ${first.y}`;
  let previous = first;
  for (const point of rest) {
    const middle = (previous.y + point.y) / 2;
    d += point.y === previous.y
      ? ` L${point.x} ${point.y}`
      : ` C${previous.x} ${middle} ${point.x} ${middle} ${point.x} ${point.y}`;
    previous = point;
  }
  return d;
}
