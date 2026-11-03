// Numbered route pins that sit on top of each other, pushed apart just enough
// to read every number. Toledo's 2-hour walk has three stops within 100m (both
// synagogues and the Museo del Greco): at any zoom that frames the whole route
// their 34px pins overlap, and stop 7 was hidden completely.
//
// Works in screen pixels, for one zoom level, and returns how far to move each
// pin's icon — never its position. The map recomputes it on every zoom, and a
// pin that isn't crowded doesn't move at all.

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// points: [{ x, y }] in pixels. Returns [{ dx, dy }] in the same order.
export function spreadPins(points, minDist = 30, iterations = 12) {
  const pos = points.map((p) => ({ x: p.x, y: p.y }));
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const vx = pos[j].x - pos[i].x;
        const vy = pos[j].y - pos[i].y;
        const dist = Math.hypot(vx, vy);
        if (dist >= minDist) continue;
        let ux;
        let uy;
        if (dist < 0.01) {
          // Same spot (two records of one building): pick a direction that
          // differs per pin, so a third one doesn't land on either of them.
          const a = j * GOLDEN_ANGLE;
          ux = Math.cos(a);
          uy = Math.sin(a);
        } else {
          ux = vx / dist;
          uy = vy / dist;
        }
        const push = (minDist - dist) / 2;
        pos[i].x -= ux * push;
        pos[i].y -= uy * push;
        pos[j].x += ux * push;
        pos[j].y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return pos.map((p, i) => ({ dx: p.x - points[i].x, dy: p.y - points[i].y }));
}
