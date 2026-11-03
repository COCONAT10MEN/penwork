import { getStroke } from "perfect-freehand";

/**
 * Ink on PDF pages. The engine keeps a stroke in page units, 1920 across the page as it is shown.
 * A file keeps it in PDF points (origin bottom-left, page rotation undone), as `CLAUDE.md` asks.
 * pdf.js's viewport at scale 1 does the turning between the two.
 */

export const UNITS_ACROSS = 1920;

/** The engine's stroke: k is pen or highlighter, w is the width, pts are [x, y, pressure]. */
export interface UnitStroke {
  k: "p" | "h";
  c: string;
  w: number;
  op?: number;
  np?: boolean;
  pts: [number, number, number][];
}

/** The same stroke in PDF points, as a file keeps it. */
export interface PointStroke {
  k: "p" | "h";
  c: string;
  w: number;
  op?: number;
  np?: boolean;
  pts: [number, number, number][];
}

/** What pdf.js's PageViewport offers for this, at scale 1. */
export interface PageView {
  width: number;
  convertToPdfPoint: (x: number, y: number) => number[];
  convertToViewportPoint: (x: number, y: number) => number[];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function toPoints(stroke: UnitStroke, view: PageView): PointStroke {
  const k = view.width / UNITS_ACROSS;
  return {
    ...stroke,
    w: round(stroke.w * k),
    pts: stroke.pts.map(([x, y, p]) => {
      const [px = 0, py = 0] = view.convertToPdfPoint(x * k, y * k);
      return [round(px), round(py), p];
    }),
  };
}

export function toUnits(stroke: PointStroke, view: PageView): UnitStroke {
  const k = UNITS_ACROSS / view.width;
  return {
    ...stroke,
    w: stroke.w * k,
    pts: stroke.pts.map(([x, y, p]) => {
      const [vx = 0, vy = 0] = view.convertToViewportPoint(x, y);
      return [vx * k, vy * k, p];
    }),
  };
}

/**
 * The stroke's filled outline, exactly as the engine draws it on screen (same settings as its
 * `outline()`), so the saved ink looks the same in any reader. Points are in the stroke's own units.
 */
export function strokeOutline(stroke: {
  k: string;
  w: number;
  np?: boolean;
  pts: number[][];
}): number[][] {
  const flat = stroke.k === "h" || stroke.np === true;
  const pts = flat ? stroke.pts.map(([x = 0, y = 0]) => [x, y, 0.5]) : stroke.pts;
  return getStroke(pts, {
    size: stroke.w,
    thinning: flat ? 0 : 0.6,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: false,
    last: true,
  });
}

/**
 * The outline as a PDF path. The engine joins outline points with quadratic curves through their
 * midpoints; PDF has only cubic ones, so each becomes the cubic that draws the same curve.
 */
export function outlinePath(outline: number[][]): string {
  if (outline.length === 0) return "";
  const pt = (i: number) => outline[(i + outline.length) % outline.length] as [number, number];
  const f = (n: number) => String(round(n));
  const [x0, y0] = pt(0);
  let path = `${f(x0)} ${f(y0)} m`;
  let [fx, fy] = [x0, y0];
  for (let i = 1; i < outline.length; i++) {
    const [cx, cy] = pt(i);
    const [nx, ny] = pt(i + 1);
    const [tx, ty] = [(cx + nx) / 2, (cy + ny) / 2];
    const c1 = [fx + (2 / 3) * (cx - fx), fy + (2 / 3) * (cy - fy)];
    const c2 = [tx + (2 / 3) * (cx - tx), ty + (2 / 3) * (cy - ty)];
    path += ` ${f(c1[0] ?? 0)} ${f(c1[1] ?? 0)} ${f(c2[0] ?? 0)} ${f(c2[1] ?? 0)} ${f(tx)} ${f(ty)} c`;
    [fx, fy] = [tx, ty];
  }
  return `${path} h f`;
}

/** A dot for a single tap, as the engine draws one: a circle as wide as the pen at that pressure. */
export function dotPath(x: number, y: number, r: number): string {
  const k = 0.5523 * r;
  const f = (n: number) => String(round(n));
  return [
    `${f(x + r)} ${f(y)} m`,
    `${f(x + r)} ${f(y + k)} ${f(x + k)} ${f(y + r)} ${f(x)} ${f(y + r)} c`,
    `${f(x - k)} ${f(y + r)} ${f(x - r)} ${f(y + k)} ${f(x - r)} ${f(y)} c`,
    `${f(x - r)} ${f(y - k)} ${f(x - k)} ${f(y - r)} ${f(x)} ${f(y - r)} c`,
    `${f(x + k)} ${f(y - r)} ${f(x + r)} ${f(y - k)} ${f(x + r)} ${f(y)} c h f`,
  ].join(" ");
}

/** The engine's width rule for a dot (its `pw()`). */
export function dotWidth(stroke: { k: string; w: number; np?: boolean }, pressure: number): number {
  return stroke.k === "h" || stroke.np
    ? stroke.w
    : Math.max(0.9, stroke.w * (0.4 + 1.2 * pressure));
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", "").slice(0, 6), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** The box around a stroke's points, padded by its width. */
export function strokeBox(pts: number[][], w: number): [number, number, number, number] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x = 0, y = 0] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const m = w + 2;
  return [round(x0 - m), round(y0 - m), round(x1 + m), round(y1 + m)];
}
