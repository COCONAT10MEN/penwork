import {
  MaterialShapes,
  Morph,
  morphToPath,
  roundedPolygonToPath,
  type MaterialShapeName,
} from "material-shapes-ts";

/** Material 3 Expressive's 35 shapes as SVG paths in a 100×100 box, and morphs between them. */
export type ShapeName = MaterialShapeName;

// The library works in a 0..1 box; ours is 100, so a pen stroke can be drawn over the logo.
const inHundreds = (d: string) =>
  d.replace(/-?\d*\.?\d+(e-?\d+)?/g, (n) => (Number(n) * 100).toFixed(2));

const paths = new Map<ShapeName, string>();

export function shapePath(name: ShapeName): string {
  let path = paths.get(name);
  if (!path) {
    path = inHundreds(roundedPolygonToPath(MaterialShapes.byName(name)).toSvgPathData());
    paths.set(name, path);
  }
  return path;
}

/** The path partway from one shape to another. Springs may ask for a little past 1. */
export function morphBetween(from: ShapeName, to: ShapeName): (progress: number) => string {
  const morph = new Morph(MaterialShapes.byName(from), MaterialShapes.byName(to));
  return (progress) => inHundreds(morphToPath(morph, progress).toSvgPathData());
}

export const COOKIE_PATH = shapePath("Cookie9Sided");
export const CLOVER_PATH = shapePath("Clover4Leaf");

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

/** The Penwork mark as text, for the dock inside the sandboxed slide page. */
export function penworkLogoSvg(): string {
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><mask id="pw-pen"><rect width="100" height="100" fill="white"/><path d="M32 66c8-3 13-10 18-20s10-16 20-18" fill="none" stroke="black" stroke-width="7" stroke-linecap="round"/></mask><path d="${COOKIE_PATH}" fill="currentColor" mask="url(#pw-pen)"/></svg>`;
}
