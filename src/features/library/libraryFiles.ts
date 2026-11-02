import type { OfficeKind } from "../../lib/office";
import type { Library, LibraryDeck } from "./libraryFile";

/** Presentations and documents are kept apart on disk. Everything on screen sees them as one list. */
export type FileKind = "deck" | OfficeKind;
export type FileFilter = "all" | FileKind;
export type FileSort = "recent" | "name" | "type";

export interface LibraryFile {
  id: string;
  path: string;
  title: string;
  kind: FileKind;
  favorite: boolean;
  lastOpened: string;
  missing: boolean;
  thumb: string | null;
  /** The file's words, for search. Only presentations have them so far. */
  text: string;
  /** What only a presentation has. */
  deck: LibraryDeck | null;
}

export const KIND_NAMES: Record<FileKind, string> = {
  deck: "Presentation",
  word: "Document",
  sheet: "Spreadsheet",
  pdf: "PDF",
};

export const KIND_ICONS: Record<FileKind, string> = {
  deck: "desktop_windows",
  word: "description",
  sheet: "table_chart",
  pdf: "picture_as_pdf",
};

/** Newest first. */
export function allFiles(library: Library): LibraryFile[] {
  const decks = library.decks.map((deck): LibraryFile => ({
    id: deck.id,
    path: deck.path,
    title: deck.title,
    kind: "deck",
    favorite: deck.favorite,
    lastOpened: deck.lastOpened,
    missing: deck.missing,
    thumb: deck.thumb,
    text: deck.text,
    deck,
  }));
  const documents = library.documents.map((document): LibraryFile => ({
    id: document.id,
    path: document.path,
    title: document.name,
    kind: document.kind,
    favorite: document.favorite,
    lastOpened: document.lastOpened,
    missing: document.missing,
    thumb: document.thumb,
    text: "",
    deck: null,
  }));
  return [...decks, ...documents].sort((a, b) => b.lastOpened.localeCompare(a.lastOpened));
}

const SORTS: Record<FileSort, (a: LibraryFile, b: LibraryFile) => number> = {
  recent: (a, b) => b.lastOpened.localeCompare(a.lastOpened),
  name: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true }),
  type: (a, b) => KIND_NAMES[a.kind].localeCompare(KIND_NAMES[b.kind]) || SORTS.name(a, b),
};

/** Every word has to appear somewhere in the file's name or its words. */
export function findFiles(
  files: LibraryFile[],
  options: { query?: string; filter?: FileFilter; sort?: FileSort; favorites?: boolean },
): LibraryFile[] {
  const { query = "", filter = "all", sort = "recent", favorites = false } = options;
  const wanted = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return files
    .filter((file) => {
      if (favorites && !file.favorite) return false;
      if (filter !== "all" && file.kind !== filter) return false;
      const words = `${file.title} ${file.text}`.toLocaleLowerCase();
      return wanted.every((word) => words.includes(word));
    })
    .sort(SORTS[sort]);
}

/** How many of each kind, so each tab can show whether it has anything in it. */
export function countByKind(files: LibraryFile[]): Record<FileFilter, number> {
  const counts = { all: files.length, deck: 0, word: 0, sheet: 0, pdf: 0 };
  for (const file of files) counts[file.kind]++;
  return counts;
}

/** Keeps the newest `limit` files. Favorites always stay. Zero means no limit. */
export function overLimit(library: Library, limit: number): string[] {
  if (limit <= 0) return [];
  return allFiles(library)
    .filter((file) => !file.favorite)
    .slice(limit)
    .map((file) => file.id);
}
