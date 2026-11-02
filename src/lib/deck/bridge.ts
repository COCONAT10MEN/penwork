/**
 * Messages from the slide iframe. Everything is untrusted: deck code shares the page with the
 * runtime, so it can send anything. Only exact, valid shapes get through.
 */

export type RuntimeMessage =
  | { type: "ready"; total: number }
  | { type: "state"; slide: number; step: number; steps: number; total: number }
  | { type: "key"; key: string; ctrl: boolean; shift: boolean; alt: boolean }
  /** A slide was clicked in the edit view's slide list. */
  | { type: "pick"; slide: number; ctrl: boolean; shift: boolean }
  /** A right-click in the slide list, in page coordinates. */
  | { type: "menu"; slide: number; x: number; y: number }
  /** A slide was dragged, to land before the slide now at `to`. */
  | { type: "move"; slide: number; to: number }
  /** Something was picked on the slide. n is -1 when nothing is. */
  | { type: "picked"; slide: number; n: number; tag: string; crumbs: Crumb[] }
  /** Delete was pressed on a bullet or something else that can simply go. */
  | { type: "removePicked"; slide: number; n: number; tag: string }
  /** Typing on the slide finished. The html is unchecked here: see lib/deck/slideEdit. */
  | { type: "text"; slide: number; n: number; tag: string; html: string }
  /** Where the formatting toolbar goes, in page coordinates, and what's on under the caret. */
  | { type: "textbar"; bar: TextBar | null }
  /** A formula is being typed. */
  | { type: "formula"; src: string }
  /** What the slide checker found, from the slide list's page. */
  | { type: "checked"; problems: SlideProblem[] }
  /** The slide list scrolled far enough to count. */
  | { type: "scrolled"; down: boolean }
  /** The End show button, or F. */
  | { type: "end" }
  /** Toolbar settings changed. fixAll in the page checks them again when they're loaded. */
  | { type: "toolbar"; settings: Record<string, unknown> }
  | { type: "exportToolbar"; text: string }
  | { type: "importToolbar" }
  /** A slide's ink changed. The strokes are still unchecked here: see lib/deck/ink. */
  | { type: "ink"; id: string; strokes: unknown };

export interface SlideProblem {
  slide: number;
  text: string;
}

export interface Crumb {
  n: number;
  label: string;
}

export interface TextBar {
  x: number;
  y: number;
  w: number;
  h: number;
  bold: boolean;
  italic: boolean;
  orange: boolean;
  teal: boolean;
  muted: boolean;
}

const MAX_SETTINGS = 256 * 1024;
const MAX_TEXT = 64 * 1024;
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isSpot = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function crumbsOf(value: unknown): Crumb[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((c: unknown) => {
    const { n, label } = (c ?? {}) as { n?: unknown; label?: unknown };
    return isCount(n) && typeof label === "string" ? [{ n, label: label.slice(0, 40) }] : [];
  });
}

export function parseRuntimeMessage(data: unknown): RuntimeMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const { v, type, payload } = data as { v?: unknown; type?: unknown; payload?: unknown };
  if (v !== 1 || typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  switch (type) {
    case "ready":
      return isCount(p.total) ? { type, total: p.total } : null;
    case "state":
      return isCount(p.slide) && isCount(p.step) && isCount(p.steps) && isCount(p.total)
        ? { type, slide: p.slide, step: p.step, steps: p.steps, total: p.total }
        : null;
    case "key":
      return typeof p.key === "string" && p.key.length <= 32
        ? { type, key: p.key, ctrl: p.ctrl === true, shift: p.shift === true, alt: p.alt === true }
        : null;
    case "pick":
      return isCount(p.slide)
        ? { type, slide: p.slide, ctrl: p.ctrl === true, shift: p.shift === true }
        : null;
    case "menu":
      return isCount(p.slide) && typeof p.x === "number" && typeof p.y === "number"
        ? { type, slide: p.slide, x: p.x, y: p.y }
        : null;
    case "move":
      return isCount(p.slide) && isCount(p.to) ? { type, slide: p.slide, to: p.to } : null;
    case "picked":
      return isCount(p.slide) && typeof p.n === "number" && typeof p.tag === "string"
        ? { type, slide: p.slide, n: p.n, tag: p.tag, crumbs: crumbsOf(p.crumbs) }
        : null;
    case "removePicked":
      return isCount(p.slide) && isCount(p.n) && typeof p.tag === "string"
        ? { type, slide: p.slide, n: p.n, tag: p.tag }
        : null;
    case "text":
      return isCount(p.slide) &&
        isCount(p.n) &&
        typeof p.tag === "string" &&
        typeof p.html === "string" &&
        p.html.length <= MAX_TEXT
        ? { type, slide: p.slide, n: p.n, tag: p.tag, html: p.html }
        : null;
    case "textbar":
      if (p.open !== true) return { type, bar: null };
      return isSpot(p.x) && isSpot(p.y) && isSpot(p.w) && isSpot(p.h)
        ? {
            type,
            bar: {
              x: p.x,
              y: p.y,
              w: p.w,
              h: p.h,
              bold: p.bold === true,
              italic: p.italic === true,
              orange: p.orange === true,
              teal: p.teal === true,
              muted: p.muted === true,
            },
          }
        : null;
    case "formula":
      return typeof p.src === "string" && p.src.length <= 2000 ? { type, src: p.src } : null;
    case "checked":
      return Array.isArray(p.problems)
        ? {
            type,
            problems: p.problems.slice(0, 200).flatMap((item: unknown) => {
              const { slide, text } = (item ?? {}) as { slide?: unknown; text?: unknown };
              return isCount(slide) && typeof text === "string"
                ? [{ slide, text: text.slice(0, 80) }]
                : [];
            }),
          }
        : null;
    case "scrolled":
      return typeof p.down === "boolean" ? { type, down: p.down } : null;
    case "end":
    case "importToolbar":
      return { type };
    case "toolbar":
      return { type, settings: p };
    case "exportToolbar":
      return typeof p.text === "string" && p.text.length <= MAX_SETTINGS
        ? { type, text: p.text }
        : null;
    case "ink":
      return typeof p.id === "string" && p.id.length <= 64
        ? { type, id: p.id, strokes: p.strokes }
        : null;
    default:
      return null;
  }
}
