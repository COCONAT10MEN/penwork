/** The parts of a deck's manifest.json the app reads (docs/DECK-FORMAT.md §2). */

export interface DeckManifest {
  title: string;
  lang: string;
  dir: "ltr" | "rtl";
  stage: { w: number; h: number };
  /** Everything else in the file, including keys from newer versions, kept for saving. */
  raw: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Forgiving by design: a missing optional key gets a default, it doesn't stop a deck opening. */
export function readManifest(value: unknown, fallbackTitle: string): DeckManifest {
  const raw = isRecord(value) ? value : {};
  const stage = isRecord(raw.stage) ? raw.stage : {};
  const number = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  return {
    title: title || fallbackTitle,
    lang: typeof raw.lang === "string" && raw.lang ? raw.lang : "en",
    dir: raw.dir === "rtl" ? "rtl" : "ltr",
    stage: { w: number(stage.w, 1920), h: number(stage.h, 1080) },
    raw,
  };
}

/** "Waves" from "C:\Decks\Waves.pwpptx". */
export function fileTitle(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? path;
  return name.replace(/\.[^.]+$/, "") || name;
}
