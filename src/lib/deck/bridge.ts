/**
 * Messages from the slide iframe. Everything is untrusted: deck code shares the page with the
 * runtime, so it can send anything. Only exact, valid shapes get through.
 */

export type RuntimeMessage =
  | { type: "ready"; total: number }
  | { type: "state"; slide: number; step: number; steps: number; total: number }
  | { type: "key"; key: string; ctrl: boolean; shift: boolean; alt: boolean }
  /** A slide was clicked in the edit view's slide list. */
  | { type: "pick"; slide: number }
  /** The overview grid opened or closed. */
  | { type: "grid"; open: boolean };

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
      return isCount(p.slide) ? { type, slide: p.slide } : null;
    case "grid":
      return typeof p.open === "boolean" ? { type, open: p.open } : null;
    default:
      return null;
  }
}
