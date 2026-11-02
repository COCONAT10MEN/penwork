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
  recordOpen,
  removeDeck,
  renameDeck,
  setFavorite,
  setLastSlide,
  setThumb,
  type Library,
} from "./features/library/libraryFile";
import { showError, showWarning } from "./features/notices/notices";
import type { DeckParts } from "./lib/deck/deckParts";
import type { DeckFacts } from "./lib/deck/facts";

interface AppState {
  library: Library;
  /** The deck on screen, or null on Home. */
  deck: OpenDeck | null;
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
  }) => void;
  closeDeck: () => void;
  startLaunch: (launch: NonNullable<AppState["launch"]>) => void;
  endLaunch: () => void;
  rememberSlide: (slide: number) => void;
  removeFromRecents: (id: string) => void;
  toggleFavorite: (id: string) => void;
  thumbSaved: (id: string, stamp: string) => void;
}

function persist(library: Library): void {
  if (!isTauri()) return;
  void invoke("write_app_file", { name: "library.json", text: JSON.stringify(library, null, 2) });
}

function reportError(error: unknown): void {
  showError(isDeckError(error) ? error.message : "This presentation couldn't be opened.");
}

export const useApp = create<AppState>((set, get) => {
  const commit = (library: Library) => {
    set({ library });
    persist(library);
  };

  const leaving = async () => (await get().leaveGuard?.()) ?? true;

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
    set({ deck, startSlide: library.decks[0]?.lastSlide ?? 0, presentOnOpen: present });
    if (deck.removed.length > 0) {
      showWarning(`Penwork removed this while opening the file: ${deck.removed.join(", ")}`);
    }
  };

  return {
    library: EMPTY_LIBRARY,
    deck: null,
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
      const paths = library.decks.map((d) => d.path);
      const exists = await invoke<boolean[]>("existing_paths", { paths });
      set({ library: markExisting(get().library, exists), libraryReady: true });
    },

    startLaunch: (launch) => set({ launch }),
    endLaunch: () => set({ launch: null }),

    openPath: async (path, options) => {
      if (!isDeckPath(path)) {
        showError("Penwork opens .pwpptx presentations only.");
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

    deckSaved: ({ oldPath, rename, path, stamp, slides, facts, ink }) => {
      const { library, deck } = get();
      const start = rename ? renameDeck(library, oldPath, path) : library;
      const title = deck?.manifest.title ?? path;
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
