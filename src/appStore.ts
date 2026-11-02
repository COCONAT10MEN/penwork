import { invoke, isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";
import {
  closeDeckFile,
  createDraft,
  isDeckError,
  isDeckPath,
  openDeckFile,
  openRecoveryFile,
  type OpenDeck,
} from "./features/deck/openDeck";
import {
  EMPTY_LIBRARY,
  markExisting,
  markMissing,
  parseLibrary,
  recordDocument,
  recordOpen,
  removeFiles,
  renameDeck,
  setFavorite,
  setLastSlide,
  setThumb,
  type Library,
} from "./features/library/libraryFile";
import { preloadThumbs } from "./features/deck/thumbnail";
import { allFiles, overLimit } from "./features/library/libraryFiles";
import { showError, showWarning } from "./features/notices/notices";
import { newOfficeFile, openOfficeFile, type OfficeFile } from "./features/office/officeFile";
import type { DeckParts } from "./lib/deck/deckParts";
import type { DeckFacts } from "./lib/deck/facts";
import { fileName, officeKind } from "./lib/office";

interface AppState {
  library: Library;
  /** The deck on screen, or null on Home. */
  deck: OpenDeck | null;
  /** The Word, Excel or PDF file on screen. */
  office: OfficeFile | null;
  startSlide: number;
  /** Open straight into the show, not the edit view. Only Present on Home asks for this. */
  presentOnOpen: boolean;
  /** Present on Home: the picture standing in for the slide while it opens. */
  launch: {
    url: string | null;
    rect: { left: number; top: number; width: number; height: number };
  } | null;
  /** Set while a deck is loading, so the UI can show it. */
  opening: boolean;
  /** True once the library has been read, so recovery can look decks up in it. */
  libraryReady: boolean;
  /** Set by the open presentation: asks about unsaved work before it's replaced or closed. */
  leaveGuard: (() => Promise<boolean>) | null;
  loadLibrary: () => Promise<void>;
  openPath: (path: string, options?: { present?: boolean }) => Promise<void>;
  newOffice: (kind: "word" | "sheet") => Promise<void>;
  closeOffice: () => void;
  officeSaved: (file: OfficeFile, path: string) => void;
  /** A new file that hasn't been saved: only its name changes. */
  officeNamed: (file: OfficeFile, name: string) => void;
  /** New deck: makes the deck, then opens it. */
  createDeck: (deck: DeckParts, generator: string) => Promise<void>;
  /** Opens a recovery copy of a presentation's unsaved work. */
  recoverDeck: (id: string, path: string) => Promise<void>;
  deckSaved: (saved: {
    oldPath: string;
    rename: boolean;
    path: string;
    stamp: string;
    slides: number;
    facts: DeckFacts;
    ink: boolean;
    title?: string;
  }) => void;
  closeDeck: () => void;
  startLaunch: (launch: NonNullable<AppState["launch"]>) => void;
  endLaunch: () => void;
  rememberSlide: (slide: number) => void;
  removeFromRecents: (id: string) => void;
  /** Empties the lists, keeping favorites. No file is touched. */
  clearRecents: () => void;
  /** Reopens the newest file, for the "last file" start setting. */
  openLast: () => Promise<void>;
  toggleFavorite: (id: string) => void;
  thumbSaved: (id: string, stamp: string) => void;
}

/** How many recent files to keep. Settings owns this, and importing it here would go in a circle. */
let recentLimit = 0;
export function setRecentLimit(limit: number): void {
  recentLimit = limit;
}

function persist(library: Library): void {
  if (!isTauri()) return;
  void invoke("write_app_file", { name: "library.json", text: JSON.stringify(library, null, 2) });
}

function reportError(error: unknown): void {
  showError(isDeckError(error) ? error.message : "This presentation couldn't be opened.");
}

export const useApp = create<AppState>((set, get) => {
  const forget = (library: Library, ids: string[]) => {
    if (isTauri()) for (const id of ids) void invoke("delete_thumb", { id });
    return ids.length > 0 ? removeFiles(library, ids) : library;
  };

  const commit = (library: Library) => {
    const kept = forget(library, overLimit(library, recentLimit));
    set({ library: kept });
    persist(kept);
  };

  const leaving = async () => (await get().leaveGuard?.()) ?? true;

  const showOffice = (office: OfficeFile) => {
    const { deck } = get();
    if (deck) closeDeckFile(deck.token);
    set({ office, deck: null });
  };

  const openOffice = async (path: string) => {
    if (!(await leaving())) return;
    set({ opening: true });
    try {
      showOffice(await openOfficeFile(path));
      const now = new Date().toISOString();
      commit(recordDocument(get().library, path, now, () => crypto.randomUUID()));
    } catch (error) {
      const name = fileName(path);
      if (error === "missing") {
        commit(markMissing(get().library, path));
        showError(`"${name}" isn't there any more. It may have been moved or renamed.`);
      } else if (error === "too large") showError(`"${name}" is too large to open.`);
      else showError(`"${name}" couldn't be opened.`);
    } finally {
      set({ opening: false });
    }
  };

  /** Puts a deck on screen and into the library, whichever way it arrived. */
  const show = (deck: OpenDeck, present = false) => {
    const previous = get().deck;
    if (previous) closeDeckFile(previous.token);
    const library = recordOpen(
      get().library,
      {
        path: deck.path,
        title: deck.manifest.title,
        slides: deck.slideCount,
        quizzes: deck.facts.quizzes,
        interactive: deck.facts.interactive,
        ink: deck.hasInk,
        text: deck.facts.text,
      },
      new Date().toISOString(),
      () => crypto.randomUUID(),
    );
    commit(library);
    set({
      deck,
      office: null,
      startSlide: library.decks[0]?.lastSlide ?? 0,
      presentOnOpen: present,
    });
    if (deck.removed.length > 0) {
      showWarning(`Penwork removed this while opening the file: ${deck.removed.join(", ")}`);
    }
  };

  return {
    library: EMPTY_LIBRARY,
    deck: null,
    office: null,
    startSlide: 0,
    presentOnOpen: false,
    launch: null,
    opening: false,
    libraryReady: false,
    leaveGuard: null,

    loadLibrary: async () => {
      if (!isTauri()) return;
      const library = parseLibrary(
        await invoke<string | null>("read_app_file", { name: "library.json" }),
      );
      set({ library });
      const paths = [...library.decks, ...library.documents].map((d) => d.path);
      const exists = await invoke<boolean[]>("existing_paths", { paths });
      set({ library: markExisting(get().library, exists), libraryReady: true });
      void preloadThumbs(allFiles(get().library));
    },

    startLaunch: (launch) => set({ launch }),
    endLaunch: () => set({ launch: null }),

    openPath: async (path, options) => {
      if (officeKind(path)) return openOffice(path);
      if (!isDeckPath(path)) {
        showError("Penwork opens presentations (.pwpptx), Word, Excel, CSV and PDF files.");
        return;
      }
      if (!(await leaving())) return;
      set({ opening: true });
      try {
        show(await openDeckFile(path), options?.present);
      } catch (error) {
        if (isDeckError(error) && error.code === "io") commit(markMissing(get().library, path));
        set({ launch: null });
        reportError(error);
      } finally {
        set({ opening: false });
      }
    },

    newOffice: async (kind) => {
      if (await leaving()) showOffice(newOfficeFile(kind));
    },

    closeOffice: () => set({ office: null }),

    officeSaved: (file, path) => {
      const now = new Date().toISOString();
      commit(recordDocument(get().library, path, now, () => crypto.randomUUID(), file.path));
      const { office } = get();
      if (office?.id === file.id) set({ office: { ...office, path, name: fileName(path) } });
    },

    officeNamed: (file, name) => {
      const { office } = get();
      if (office?.id === file.id) set({ office: { ...office, name } });
    },

    recoverDeck: async (id, path) => {
      if (!(await leaving())) return;
      set({ opening: true });
      try {
        show(await openRecoveryFile(id, path));
      } catch (error) {
        reportError(error);
      } finally {
        set({ opening: false });
      }
    },

    deckSaved: ({ oldPath, rename, path, stamp, slides, facts, ink, title: newTitle }) => {
      const { library, deck } = get();
      const start = rename ? renameDeck(library, oldPath, path) : library;
      const title = newTitle ?? deck?.manifest.title ?? path;
      commit(
        recordOpen(start, { path, title, slides, ink, ...facts }, new Date().toISOString(), () =>
          crypto.randomUUID(),
        ),
      );
      if (deck) set({ deck: { ...deck, path, stamp, draft: false, slideCount: slides } });
    },

    createDeck: async (deck, generator) => {
      if (!(await leaving())) return;
      set({ opening: true });
      try {
        show(await createDraft(deck, generator));
      } catch (error) {
        reportError(error);
      } finally {
        set({ opening: false });
      }
    },

    closeDeck: () => {
      const { deck } = get();
      if (deck) closeDeckFile(deck.token);
      set({ deck: null });
    },

    rememberSlide: (slide) => {
      const { deck, library } = get();
      if (deck) commit(setLastSlide(library, deck.path, slide));
    },

    removeFromRecents: (id) => commit(forget(get().library, [id])),

    clearRecents: () => {
      const { library } = get();
      const ids = allFiles(library).filter((f) => !f.favorite);
      commit(forget(library, ids.map((f) => f.id)));
    },

    openLast: async () => {
      const last = allFiles(get().library).find((f) => !f.missing);
      if (last) await get().openPath(last.path);
    },

    toggleFavorite: (id) => {
      const { library } = get();
      const file = allFiles(library).find((f) => f.id === id);
      if (file) commit(setFavorite(library, id, !file.favorite));
    },

    thumbSaved: (id, stamp) => commit(setThumb(get().library, id, stamp)),
  };
});
