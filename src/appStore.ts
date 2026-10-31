import { invoke, isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";
import {
  closeDeckFile,
  createDraft,
  fileKind,
  importHtmlFile,
  isDeckError,
  openDeckFile,
  type OpenDeck,
} from "./features/deck/openDeck";
import {
  EMPTY_LIBRARY,
  markExisting,
  markMissing,
  parseLibrary,
  recordOpen,
  removeDeck,
  setFavorite,
  setLastSlide,
  setThumb,
  type Library,
} from "./features/library/libraryFile";
import type { ImportedDeck } from "./lib/deck/importHtml";

export interface AppNotice {
  message: string;
  duration?: number;
}
type Notify = (notice: AppNotice) => void;

interface AppState {
  library: Library;
  /** The deck on screen, or null on Home. */
  deck: OpenDeck | null;
  startSlide: number;
  /** Set while a deck is loading, so the UI can show it. */
  opening: boolean;
  loadLibrary: () => Promise<void>;
  openPath: (path: string, notify: Notify) => Promise<void>;
  /** Paste from AI and New deck: makes the deck, then opens it. */
  createDeck: (deck: ImportedDeck, generator: string, notify: Notify) => Promise<void>;
  closeDeck: () => void;
  rememberSlide: (slide: number) => void;
  removeFromRecents: (id: string) => void;
  toggleFavorite: (id: string) => void;
  thumbSaved: (id: string, stamp: string) => void;
}

function persist(library: Library): void {
  if (!isTauri()) return;
  void invoke("write_app_file", { name: "library.json", text: JSON.stringify(library, null, 2) });
}

function reportError(error: unknown, notify: Notify): void {
  const message = isDeckError(error) ? error.message : "This deck couldn't be opened.";
  notify({ message, duration: 10_000 });
}

export const useApp = create<AppState>((set, get) => {
  const commit = (library: Library) => {
    set({ library });
    persist(library);
  };

  /** Puts a deck on screen and into the library, whichever way it arrived. */
  const show = (deck: OpenDeck, notify: Notify) => {
    const previous = get().deck;
    if (previous) closeDeckFile(previous.token);
    const known = get().library.decks.some((d) => d.path.toLowerCase() === deck.path.toLowerCase());
    const library = recordOpen(
      get().library,
      {
        path: deck.path,
        kind: fileKind(deck.path) === "html" ? "html" : "pwpptx",
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
    set({ deck, startSlide: library.decks[0]?.lastSlide ?? 0 });
    const notes: string[] = [];
    if (deck.importNotes && !known) {
      notes.push(`Imported ${deck.slideCount} slides. The original file wasn't changed.`);
    }
    if (deck.removed.length > 0) notes.push(`Cleaned up while opening: ${deck.removed.join(", ")}`);
    if (deck.importNotes?.length) notes.push(deck.importNotes.join(", "));
    if (notes.length > 0) notify({ message: notes.join(" "), duration: 10_000 });
  };

  return {
    library: EMPTY_LIBRARY,
    deck: null,
    startSlide: 0,
    opening: false,

    loadLibrary: async () => {
      if (!isTauri()) return;
      const library = parseLibrary(
        await invoke<string | null>("read_app_file", { name: "library.json" }),
      );
      set({ library });
      const paths = library.decks.map((d) => d.path);
      const exists = await invoke<boolean[]>("existing_paths", { paths });
      set({ library: markExisting(get().library, exists) });
    },

    openPath: async (path, notify) => {
      const kind = fileKind(path);
      if (kind === "other") {
        notify({ message: "Penwork opens .pwpptx decks and .html slide decks." });
        return;
      }
      set({ opening: true });
      try {
        show(await (kind === "html" ? importHtmlFile(path) : openDeckFile(path)), notify);
      } catch (error) {
        if (isDeckError(error) && error.code === "io") commit(markMissing(get().library, path));
        reportError(error, notify);
      } finally {
        set({ opening: false });
      }
    },

    createDeck: async (deck, generator, notify) => {
      set({ opening: true });
      try {
        show(await createDraft(deck, generator), notify);
      } catch (error) {
        reportError(error, notify);
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

    removeFromRecents: (id) => {
      commit(removeDeck(get().library, id));
      if (isTauri()) void invoke("delete_thumb", { id });
    },

    toggleFavorite: (id) => {
      const { library } = get();
      const deck = library.decks.find((d) => d.id === id);
      if (deck) commit(setFavorite(library, id, !deck.favorite));
    },

    thumbSaved: (id, stamp) => commit(setThumb(get().library, id, stamp)),
  };
});
