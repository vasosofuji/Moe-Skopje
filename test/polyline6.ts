// Test helper: Valhalla's encoded `shape` (polyline with 6 decimals, [lat, lng] pairs) from [lng, lat] positions.
export function encodePolyline6(points: [number, number][]): string {
  let prev = [0, 0];
  let out = "";
  for (const [lng, lat] of points) {
    const now = [Math.round(lat * 1e6), Math.round(lng * 1e6)];
    for (const [i, v] of now.entries()) {
      let d = v - prev[i];
      d = d < 0 ? ~(d << 1) : d << 1;
      while (d >= 0x20) {
        out += String.fromCharCode((0x20 | (d & 0x1f)) + 63);
        d >>= 5;
      }
      out += String.fromCharCode(d + 63);
    }
    prev = now;
  }
  return out;
}
