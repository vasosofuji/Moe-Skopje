// Maps a w×h box onto a four-corner quad (a phone screen in a still) as a CSS matrix3d.
// Use with transform-origin: 0 0. Self-contained so `node --test` can load it.

export type Pt = [number, number];

// Solve the 8 homography unknowns [a b c d e f g h] from the 4 corner pairs (Gaussian elimination).
export function quadToMatrix3d(w: number, h: number, corners: [Pt, Pt, Pt, Pt]): string {
  const src: Pt[] = [[0, 0], [w, 0], [w, h], [0, h]];
  const A: number[][] = [];
  src.forEach(([x, y], i) => {
    const [X, Y] = corners[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X, X]);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y, Y]);
  });
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const k = A[r][col] / A[col][col];
      for (let c = col; c < 9; c++) A[r][c] -= k * A[col][c];
    }
  }
  const [a, b, c, d, e, f, g, hh] = A.map((row, i) => row[8] / row[i]);
  return `matrix3d(${[a, d, 0, g, b, e, 0, hh, 0, 0, 1, 0, c, f, 0, 1].join(",")})`;
}
