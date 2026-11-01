/** library.json (docs/ARCHITECTURE-DECKS.md §7). Removing an entry never touches the deck file. */

export interface LibraryDeck {
  id: string;
  path: string;
  title: string;
  slides: number;
  favorite: boolean;
  lastOpened: string;
  lastSlide: number;
  lastStep: number;
  /** The file version the cached thumbnail shows. Null when there is none yet. */
  thumb: string | null;
  missing: boolean;
  quizzes: number;
  interactive: boolean;
  ink: boolean;
  /** Slide words, for search. */
  text: string;
}

export interface Library {
  version: 1;
  decks: LibraryDeck[];
}

export const EMPTY_LIBRARY: Library = { version: 1, decks: [] };

function readDeck(value: unknown): LibraryDeck | null {
  if (typeof value !== "object" || value === null) return null;
  const d = value as Record<string, unknown>;
  if (typeof d.id !== "string" || typeof d.path !== "string" || !d.path) return null;
  const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0);
  return {
    id: d.id,
    path: d.path,
    title: typeof d.title === "string" && d.title ? d.title : d.path,
    slides: count(d.slides),
    favorite: d.favorite === true,
    lastOpened: typeof d.lastOpened === "string" ? d.lastOpened : new Date(0).toISOString(),
    lastSlide: count(d.lastSlide),
    lastStep: count(d.lastStep),
    thumb: typeof d.thumb === "string" ? d.thumb : null,
    missing: d.missing === true,
    quizzes: count(d.quizzes),
    interactive: d.interactive === true,
    ink: d.ink === true,
    text: typeof d.text === "string" ? d.text : "",
  };
}

/** A damaged library file must never stop the app starting: bad rows are dropped. */
export function parseLibrary(text: string | null): Library {
  if (!text) return EMPTY_LIBRARY;
  try {
    const data = JSON.parse(text) as { decks?: unknown };
    if (!Array.isArray(data.decks)) return EMPTY_LIBRARY;
    const decks = data.decks.map(readDeck).filter((d): d is LibraryDeck => d !== null);
    return { version: 1, decks };
  } catch {
    return EMPTY_LIBRARY;
  }
}

/** Newest first. Windows paths ignore case, so the same file isn't listed twice. */
export function recordOpen(
  library: Library,
  entry: Pick<
    LibraryDeck,
    "path" | "title" | "slides" | "quizzes" | "interactive" | "ink" | "text"
  >,
  now: string,
  newId: () => string,
): Library {
  const key = entry.path.toLowerCase();
  const existing = library.decks.find((d) => d.path.toLowerCase() === key);
  const updated: LibraryDeck = {
    id: existing?.id ?? newId(),
    favorite: existing?.favorite ?? false,
    lastSlide: existing?.lastSlide ?? 0,
    lastStep: existing?.lastStep ?? 0,
    thumb: existing?.thumb ?? null,
    ...entry,
    lastOpened: now,
    missing: false,
  };
  return {
    ...library,
    decks: [updated, ...library.decks.filter((d) => d !== existing)],
  };
}

export function removeDeck(library: Library, id: string): Library {
  return { ...library, decks: library.decks.filter((d) => d.id !== id) };
}

export function markMissing(library: Library, path: string): Library {
  const key = path.toLowerCase();
  return {
    ...library,
    decks: library.decks.map((d) => (d.path.toLowerCase() === key ? { ...d, missing: true } : d)),
  };
}

export function setLastSlide(library: Library, path: string, slide: number): Library {
  const key = path.toLowerCase();
  return {
    ...library,
    decks: library.decks.map((d) =>
      d.path.toLowerCase() === key ? { ...d, lastSlide: slide } : d,
    ),
  };
}

export function setFavorite(library: Library, id: string, favorite: boolean): Library {
  return { ...library, decks: library.decks.map((d) => (d.id === id ? { ...d, favorite } : d)) };
}

/** A draft that was saved somewhere real is the same presentation, so it keeps its place. */
export function renameDeck(library: Library, oldPath: string, path: string): Library {
  const key = oldPath.toLowerCase();
  return {
    ...library,
    decks: library.decks.map((d) => (d.path.toLowerCase() === key ? { ...d, path } : d)),
  };
}

export function setInkFlag(library: Library, id: string, ink: boolean): Library {
  return { ...library, decks: library.decks.map((d) => (d.id === id ? { ...d, ink } : d)) };
}

export function setThumb(library: Library, id: string, stamp: string): Library {
  return {
    ...library,
    decks: library.decks.map((d) => (d.id === id ? { ...d, thumb: stamp } : d)),
  };
}

/** Files moved or deleted since last time. `exists` lines up with `library.decks`. */
export function markExisting(library: Library, exists: boolean[]): Library {
  return {
    ...library,
    decks: library.decks.map((d, i) => ({ ...d, missing: exists[i] === false })),
  };
}
