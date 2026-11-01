import { createStore } from "zustand";
import type { DeckSlide } from "../../lib/deck/slideOps";

/** One open presentation's slides and history (docs/ARCHITECTURE-DECKS.md §3). */

const MAX_HISTORY = 200;

export interface DeckDoc {
  slides: DeckSlide[];
  past: DeckSlide[][];
  future: DeckSlide[][];
  /** The list that's in the file. Undoing back to it means there's nothing to save. */
  saved: DeckSlide[] | null;
  inkChanged: boolean;
}

export type DeckStore = ReturnType<typeof createDeckStore>;

/** `recovered` work isn't in the file yet, so it starts out unsaved. */
export function createDeckStore(slides: DeckSlide[], recovered = false) {
  return createStore<DeckDoc>(() => ({
    slides,
    past: [],
    future: [],
    saved: recovered ? null : slides,
    inkChanged: recovered,
  }));
}

export function isDirty(doc: DeckDoc): boolean {
  return doc.inkChanged || doc.slides !== doc.saved;
}

export function commit(store: DeckStore, slides: DeckSlide[]): void {
  store.setState((doc) => ({
    slides,
    past: [...doc.past, doc.slides].slice(-MAX_HISTORY),
    future: [],
  }));
}

export function undo(store: DeckStore): DeckSlide[] | null {
  const { past, slides, future } = store.getState();
  const previous = past[past.length - 1];
  if (!previous) return null;
  store.setState({ slides: previous, past: past.slice(0, -1), future: [slides, ...future] });
  return previous;
}

export function redo(store: DeckStore): DeckSlide[] | null {
  const { past, slides, future } = store.getState();
  const next = future[0];
  if (!next) return null;
  store.setState({ slides: next, past: [...past, slides], future: future.slice(1) });
  return next;
}

export function markSaved(store: DeckStore): void {
  store.setState((doc) => ({ saved: doc.slides, inkChanged: false }));
}
