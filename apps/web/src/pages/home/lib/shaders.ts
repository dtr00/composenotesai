import { hash, type Shader } from "@/shared/lib/dither";

export const heroLight: Shader = (width, height, seconds) => (x, y) => {
  const nx = (x - width / 2) / (width * 0.42);
  const ny = (y - height * 0.08) / (height * 0.72);
  const light = Math.exp(-(nx * nx + ny * ny * 1.4) * 2.4);
  const shimmer = Math.sin(x * 0.045 + seconds * 0.5) * Math.cos(y * 0.06 - seconds * 0.35);
  return light * (0.5 + 0.08 * shimmer);
};

const NODES = 64;
const CLUSTERS = 4;

const POINTS = Array.from({ length: NODES }, (_, i) => {
  const cluster = i % CLUSTERS;
  const angle = (cluster / CLUSTERS) * Math.PI * 2;
  return {
    cluster,
    x: Math.cos(angle) * 0.78 + (hash(i, 1) - 0.5) * 0.7,
    y: (cluster % 2 ? 0.25 : -0.25) * 1.2 + (hash(i, 2) - 0.5) * 0.7,
    z: Math.sin(angle) * 0.78 + (hash(i, 3) - 0.5) * 0.7,
  };
});

const EDGES = POINTS.flatMap((from, i) =>
  POINTS.slice(i + 1)
    .map((_, offset) => i + 1 + offset)
    .filter((j) => POINTS[j].cluster === from.cluster && hash(i, j) < 0.14)
    .map((j): [number, number] => [i, j]),
);

export const noteGraph: Shader = (width, height, seconds) => {
  const unit = Math.min(width, height) * 0.4;
  const spin = seconds * 0.22;
  const nodes = POINTS.map((point) => {
    const x = point.x * Math.cos(spin) + point.z * Math.sin(spin);
    const depth = -point.x * Math.sin(spin) + point.z * Math.cos(spin);
    const perspective = 2.6 / (2.6 + depth);
    return { x: width / 2 + x * unit * perspective, y: height / 2 + point.y * unit * perspective, depth };
  });

  return (x, y) => {
    for (const node of nodes) {
      const size = 1.15 - node.depth * 0.35;
      if ((x - node.x) ** 2 + (y - node.y) ** 2 < size * size) return node.depth < 0 ? 1 : 0.7;
    }
    let density = 0;
    EDGES.forEach(([a, b], index) => {
      const from = nodes[a];
      const to = nodes[b];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((x - from.x) * dx + (y - from.y) * dy) / length));
      const distance = Math.hypot(x - (from.x + t * dx), y - (from.y + t * dy));
      if (distance > 0.7) return;
      const pulse = Math.max(0, Math.sin(seconds * 1.4 - index * 0.7)) ** 4;
      const travel = Math.abs(t - ((seconds * 0.6 + index * 0.13) % 1)) < 0.06 ? 0.6 : 0;
      density = Math.max(density, 0.38 + 0.5 * pulse + travel);
    });
    return density;
  };
};
