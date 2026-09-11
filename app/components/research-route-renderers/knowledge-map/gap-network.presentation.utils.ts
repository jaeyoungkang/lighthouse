export interface GapNetworkPoint {
  x: number;
  y: number;
}

export function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function getConvexHull(points: GapNetworkPoint[]) {
  if (points.length <= 1) {
    return points.slice();
  }

  const sorted = points
    .slice()
    .sort((left, right) => (left.x === right.x ? left.y - right.y : left.x - right.x));

  const cross = (origin: GapNetworkPoint, a: GapNetworkPoint, b: GapNetworkPoint) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);

  const lower: GapNetworkPoint[] = [];
  for (const point of sorted) {
    while (lower.length >= 2) {
      const penultimate = lower[lower.length - 2];
      const last = lower[lower.length - 1];
      if (cross(penultimate, last, point) > 0) {
        break;
      }
      lower.pop();
    }
    lower.push(point);
  }

  const upper: GapNetworkPoint[] = [];
  for (const point of sorted.slice().reverse()) {
    while (upper.length >= 2) {
      const penultimate = upper[upper.length - 2];
      const last = upper[upper.length - 1];
      if (cross(penultimate, last, point) > 0) {
        break;
      }
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

export function buildSoftHullPath(points: GapNetworkPoint[]) {
  if (points.length === 0) {
    return "";
  }

  if (points.length < 3) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const rx = Math.max((Math.max(...xs) - Math.min(...xs)) / 2, 56);
    const ry = Math.max((Math.max(...ys) - Math.min(...ys)) / 2, 44);
    return [
      `M ${String(cx - rx)} ${String(cy)}`,
      `a ${String(rx)} ${String(ry)} 0 1 0 ${String(rx * 2)} 0`,
      `a ${String(rx)} ${String(ry)} 0 1 0 ${String(-rx * 2)} 0`,
    ].join(" ");
  }

  const midpoints = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return {
      x: (point.x + next.x) / 2,
      y: (point.y + next.y) / 2,
    };
  });

  const start = midpoints[midpoints.length - 1];
  const segments = [`M ${String(start.x)} ${String(start.y)}`];
  points.forEach((point, index) => {
    const midpoint = midpoints[index];
    segments.push(
      `Q ${String(point.x)} ${String(point.y)} ${String(midpoint.x)} ${String(midpoint.y)}`,
    );
  });
  segments.push("Z");

  return segments.join(" ");
}

export function getBezierPoint(params: {
  start: GapNetworkPoint;
  control: GapNetworkPoint;
  end: GapNetworkPoint;
  t: number;
}) {
  const mt = 1 - params.t;
  return {
    x:
      mt * mt * params.start.x +
      2 * mt * params.t * params.control.x +
      params.t * params.t * params.end.x,
    y:
      mt * mt * params.start.y +
      2 * mt * params.t * params.control.y +
      params.t * params.t * params.end.y,
  };
}
