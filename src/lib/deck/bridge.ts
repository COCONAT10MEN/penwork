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
  /** The End show button, or F. */
  | { type: "end" }
  /** Toolbar settings changed. fixAll in the page checks them again when they're loaded. */
  | { type: "toolbar"; settings: Record<string, unknown> }
  | { type: "exportToolbar"; text: string }
  | { type: "importToolbar" }
  /** A slide's ink changed. The strokes are still unchecked here: see lib/deck/ink. */
  | { type: "ink"; id: string; strokes: unknown };

const MAX_SETTINGS = 256 * 1024;
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

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
