import { fileName, officeKind, type OfficeKind } from "../../lib/office";

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

/** A Word, Excel or PDF file. These have no slides or covers, so they keep a list of their own. */
export interface LibraryDocument {
  id: string;
  path: string;
  name: string;
  kind: OfficeKind;
  favorite: boolean;
  lastOpened: string;
  missing: boolean;
  /** When the cached picture of the first page was taken. Null when there is none yet. */
  thumb: string | null;
}

export interface Library {
  version: 1;
  decks: LibraryDeck[];
  documents: LibraryDocument[];
}

export const EMPTY_LIBRARY: Library = { version: 1, decks: [], documents: [] };

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

function readDocument(value: unknown): LibraryDocument | null {
  if (typeof value !== "object" || value === null) return null;
  const d = value as Record<string, unknown>;
  if (typeof d.id !== "string" || typeof d.path !== "string") return null;
  const kind = officeKind(d.path);
  if (!kind) return null;
  return {
    id: d.id,
    path: d.path,
    name: fileName(d.path),
    kind,
    favorite: d.favorite === true,
    lastOpened: typeof d.lastOpened === "string" ? d.lastOpened : new Date(0).toISOString(),
    missing: d.missing === true,
    thumb: typeof d.thumb === "string" ? d.thumb : null,
  };
}

/** A damaged library file must never stop the app starting: bad rows are dropped. */
export function parseLibrary(text: string | null): Library {
  if (!text) return EMPTY_LIBRARY;
  try {
    const data = JSON.parse(text) as { decks?: unknown; documents?: unknown };
    if (!Array.isArray(data.decks)) return EMPTY_LIBRARY;
    const decks = data.decks.map(readDeck).filter((d): d is LibraryDeck => d !== null);
    const rows: unknown[] = Array.isArray(data.documents) ? data.documents : [];
    const documents = rows.map(readDocument).filter((d) => d !== null);
    return { version: 1, decks, documents };
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

/** A file opened, or saved somewhere new, goes to the top. `replaces` is the path it had before. */
export function recordDocument(
  library: Library,
  path: string,
  now: string,
  newId: () => string,
  replaces: string | null = null,
): Library {
  const kind = officeKind(path);
  if (!kind) return library;
  const keys = [path.toLowerCase(), replaces?.toLowerCase()];
  const existing = library.documents.find((d) => keys.includes(d.path.toLowerCase()));
  const updated: LibraryDocument = {
    id: existing?.id ?? newId(),
    path,
    name: fileName(path),
    kind,
    favorite: existing?.favorite ?? false,
    lastOpened: now,
    missing: false,
    thumb: existing?.thumb ?? null,
  };
  const others = library.documents.filter((d) => !keys.includes(d.path.toLowerCase()));
  return { ...library, documents: [updated, ...others] };
}

/** Takes these files off the lists, whatever type they are. The files themselves aren't touched. */
export function removeFiles(library: Library, ids: string[]): Library {
  const gone = new Set(ids);
  return {
    ...library,
    decks: library.decks.filter((d) => !gone.has(d.id)),
    documents: library.documents.filter((d) => !gone.has(d.id)),
  };
}

export function markMissing(library: Library, path: string): Library {
  const key = path.toLowerCase();
  const mark = <T extends { path: string }>(d: T) =>
    d.path.toLowerCase() === key ? { ...d, missing: true } : d;
  return { ...library, decks: library.decks.map(mark), documents: library.documents.map(mark) };
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
  const mark = <T extends { id: string }>(d: T) => (d.id === id ? { ...d, favorite } : d);
  return { ...library, decks: library.decks.map(mark), documents: library.documents.map(mark) };
}

/** A draft that was saved somewhere real is the same presentation, so it keeps its place. */
export function renameDeck(library: Library, oldPath: string, path: string): Library {
  const key = oldPath.toLowerCase();
  // Saved over a file already listed: that row is now this presentation.
  const taken = path.toLowerCase();
  return {
    ...library,
    decks: library.decks
      .filter((d) => d.path.toLowerCase() !== taken)
      .map((d) => (d.path.toLowerCase() === key ? { ...d, path } : d)),
  };
}

export function setThumb(library: Library, id: string, stamp: string): Library {
  const mark = <T extends { id: string }>(d: T) => (d.id === id ? { ...d, thumb: stamp } : d);
  return { ...library, decks: library.decks.map(mark), documents: library.documents.map(mark) };
}

/** Files moved or deleted since last time. `exists` lines up with the decks, then the documents. */
export function markExisting(library: Library, exists: boolean[]): Library {
  const count = library.decks.length;
  return {
    ...library,
    decks: library.decks.map((d, i) => ({ ...d, missing: exists[i] === false })),
    documents: library.documents.map((d, i) => ({ ...d, missing: exists[count + i] === false })),
  };
}
