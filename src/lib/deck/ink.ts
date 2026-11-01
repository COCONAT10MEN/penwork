/**
 * ink.json (docs/DECK-FORMAT.md §6). Strokes come from the slide page, which deck code shares, or
 * from a file, so they're checked here before they are saved or shown.
 */

export interface InkStroke {
  k: "p" | "h";
  c: string;
  w: number;
  op: number;
  np: boolean;
  pts: [number, number, number][];
}

export type InkBySlide = Record<string, InkStroke[]>;

const MAX_STROKES = 5000;
const MAX_POINTS = 50_000;
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function readPoint(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const [x, y, p = 0.5] = value as unknown[];
  return isNumber(x) && isNumber(y) && isNumber(p) ? [x, y, p] : null;
}

function readStroke(value: unknown): InkStroke | null {
  if (typeof value !== "object" || value === null) return null;
  const s = value as Record<string, unknown>;
  if ((s.k !== "p" && s.k !== "h") || typeof s.c !== "string" || !/^#[0-9a-f]{6}$/i.test(s.c)) {
    return null;
  }
  if (!isNumber(s.w) || s.w <= 0 || s.w > 200 || !Array.isArray(s.pts)) return null;
  if (s.pts.length === 0 || s.pts.length > MAX_POINTS) return null;
  const pts = s.pts.map(readPoint);
  if (pts.some((p) => p === null)) return null;
  return {
    k: s.k,
    c: s.c,
    w: s.w,
    op: isNumber(s.op) ? Math.min(1, Math.max(0, s.op)) : 1,
    np: s.np === true,
    pts: pts as [number, number, number][],
  };
}

/** Bad strokes are dropped one by one, so one can't cost the rest of a slide's ink. */
export function readStrokes(value: unknown): InkStroke[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_STROKES)
    .map(readStroke)
    .filter((s): s is InkStroke => s !== null);
}

export function readInk(value: unknown): InkBySlide {
  if (typeof value !== "object" || value === null) return {};
  const slides = (value as { slides?: unknown }).slides;
  if (typeof slides !== "object" || slides === null) return {};
  const out: InkBySlide = {};
  for (const [id, strokes] of Object.entries(slides)) {
    // An empty list stays: it says a slide's ink was erased, over any ink in the file.
    if (Array.isArray(strokes)) out[id] = readStrokes(strokes);
  }
  return out;
}

export function writeInk(slides: InkBySlide): string {
  return JSON.stringify({ version: 1, slides });
}

export function hasInk(slides: InkBySlide): boolean {
  return Object.values(slides).some((strokes) => strokes.length > 0);
}
