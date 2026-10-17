// Small planar-geometry helpers for the street index and parking zones (no I/O, no dependencies).

const M_PER_DEG = 111_320; // metres per degree of latitude (and of longitude at the equator)

/**
 * Douglas-Peucker: drops every vertex that lies within `toleranceM` metres of the line between the vertices kept around it.
 * Endpoints are always kept. Distances are measured on a local plane (longitude scaled by cos of the line's latitude).
 * Iterative, so a 50k-vertex line cannot overflow the stack.
 */
export function simplifyLine(coords: number[][], toleranceM: number): number[][] {
  if (coords.length < 3) return coords;
  const k = Math.cos((coords[0][1] * Math.PI) / 180);
  const x = (p: number[]) => p[0] * k * M_PER_DEG;
  const y = (p: number[]) => p[1] * M_PER_DEG;

  /** Distance from p to the segment a-b, in metres. */
  const dist = (p: number[], a: number[], b: number[]) => {
    const dx = x(b) - x(a);
    const dy = y(b) - y(a);
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x(p) - x(a)) * dx + (y(p) - y(a)) * dy) / len2));
    return Math.hypot(x(p) - (x(a) + t * dx), y(p) - (y(a) + t * dy));
  };

  const keep = new Uint8Array(coords.length);
  keep[0] = keep[coords.length - 1] = 1;
  const stack: [number, number][] = [[0, coords.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    let far = -1;
    let farD = toleranceM;
    for (let i = lo + 1; i < hi; i++) {
      const d = dist(coords[i], coords[lo], coords[hi]);
      if (d > farD) {
        far = i;
        farD = d;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([lo, far], [far, hi]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

/** [west, south, east, north] over every position of a geometry. */
export function bboxOf(g: GeoJSON.Geometry): [number, number, number, number] {
  const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === "number") {
      box[0] = Math.min(box[0], c[0]);
      box[1] = Math.min(box[1], c[1]);
      box[2] = Math.max(box[2], c[0]);
      box[3] = Math.max(box[3], c[1]);
    } else c.forEach(walk);
  };
  if ("coordinates" in g) walk(g.coordinates);
  return box;
}
