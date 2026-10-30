/** Expressive shapes as SVG paths in a 100×100 box. Pure math, so they can be tested. */

const CENTER = 50;
const RADIUS = 49;

/**
 * A closed shape from a radius function. Every shape has the same number of points, which is
 * what lets LoadingIndicator morph between them.
 */
export function radialPath(radiusAt: (angle: number) => number, samples = 120): string {
  const points: string[] = [];
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2 - Math.PI / 2;
    const r = radiusAt(a);
    const x = CENTER + Math.cos(a) * r;
    const y = CENTER + Math.sin(a) * r;
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
}

/** Soft scallops, like a cookie. */
export function scallopPath(lobes: number, depth = 0.08): string {
  return radialPath((a) => RADIUS * (1 - depth + depth * Math.cos(lobes * a)));
}

/** Deep rounded leaves, like a clover. */
export function cloverPath(leaves = 4): string {
  return radialPath((a) => RADIUS * (0.55 + 0.45 * Math.abs(Math.cos((leaves / 2) * a)) ** 0.7));
}

export const COOKIE_PATH = scallopPath(9);
export const CLOVER_PATH = cloverPath(4);
export const CIRCLE_PATH = radialPath(() => RADIUS);

/** A sine line from x=0 to x=width around y=mid, as one smooth path. */
export function wavyLinePath(width: number, wavelength: number, amplitude: number, mid: number) {
  const q = wavelength / 4;
  let d = `M0 ${mid}`;
  for (let x = 0, up = true; x < width; x += wavelength / 2, up = !up) {
    d += `Q${x + q} ${mid + (up ? -amplitude * 2 : amplitude * 2)} ${x + 2 * q} ${mid}`;
  }
  return d;
}

/** A circle whose edge ripples, for the wavy CircularProgress. */
export function wavyCirclePath(radius: number, amplitude: number, waves: number, center: number) {
  const samples = waves * 12;
  const points: string[] = [];
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2 - Math.PI / 2;
    const r = radius + amplitude * Math.sin(waves * a);
    points.push(
      `${(center + Math.cos(a) * r).toFixed(2)} ${(center + Math.sin(a) * r).toFixed(2)}`,
    );
  }
  return `M${points.join("L")}Z`;
}
