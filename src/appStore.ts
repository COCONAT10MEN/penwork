import { invoke, isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";
import {
  closeDeckFile,
  fileKind,
  isDeckError,
  openDeckFile,
  type OpenDeck,
} from "./features/deck/openDeck";
import {
  EMPTY_LIBRARY,
  markMissing,
  parseLibrary,
  recordOpen,
  removeDeck,
  setLastSlide,
  type Library,
} from "./features/library/libraryFile";

export interface AppNotice {
  message: string;
  duration?: number;
}

interface AppState {
  library: Library;
  /** The deck on screen, or null on Home. */
  deck: OpenDeck | null;
  startSlide: number;
  /** Set while a deck is loading, so the UI can show it. */
  opening: boolean;
  loadLibrary: () => Promise<void>;
  openPath: (path: string, notify: (notice: AppNotice) => void) => Promise<void>;
  closeDeck: () => void;
  rememberSlide: (slide: number) => void;
  removeFromRecents: (id: string) => void;
}

function persist(library: Library): void {
  if (!isTauri()) return;
  void invoke("write_app_file", { name: "library.json", text: JSON.stringify(library, null, 2) });
}

export const useApp = create<AppState>((set, get) => {
  const commit = (library: Library) => {
    set({ library });
    persist(library);
  };

  return {
    library: EMPTY_LIBRARY,
    deck: null,
    startSlide: 0,
    opening: false,

    loadLibrary: async () => {
      if (!isTauri()) return;
      set({
        library: parseLibrary(
          await invoke<string | null>("read_app_file", { name: "library.json" }),
        ),
      });
    },

    openPath: async (path, notify) => {
      const kind = fileKind(path);
      if (kind === "html") {
        notify({ message: "Importing .html decks comes in the next update." });
        return;
      }
      if (kind === "other") {
        notify({ message: "Penwork opens .pwpptx decks." });
        return;
      }
      set({ opening: true });
      try {
        const deck = await openDeckFile(path);
        const previous = get().deck;
        if (previous) closeDeckFile(previous.token);
        const library = recordOpen(
          get().library,
          { path, kind, title: deck.manifest.title, slides: deck.slideCount },
          new Date().toISOString(),
          () => crypto.randomUUID(),
        );
        const entry = library.decks[0];
        commit(library);
        set({ deck, startSlide: entry?.lastSlide ?? 0 });
        if (deck.removed.length > 0) {
          notify({
            message: `Cleaned up while opening: ${deck.removed.join(", ")}`,
            duration: 10_000,
          });
        }
      } catch (error) {
        if (isDeckError(error)) {
          if (error.code === "io") commit(markMissing(get().library, path));
          notify({ message: error.message, duration: 10_000 });
        } else {
          notify({ message: "This deck couldn't be opened.", duration: 10_000 });
        }
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

    removeFromRecents: (id) => commit(removeDeck(get().library, id)),
  };
});
