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
  /** Counted, so a stroke drawn while a Save is running still shows as unsaved afterwards. */
  inkEdits: number;
  savedInk: number;
}

export type DeckStore = ReturnType<typeof createDeckStore>;

/** `recovered` work isn't in the file yet, so it starts out unsaved. */
export function createDeckStore(slides: DeckSlide[], recovered = false) {
  return createStore<DeckDoc>(() => ({
    slides,
    past: [],
    future: [],
    saved: recovered ? null : slides,
    inkEdits: 0,
    savedInk: 0,
  }));
}

export function isDirty(doc: DeckDoc): boolean {
  return doc.inkEdits !== doc.savedInk || doc.slides !== doc.saved;
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

export function noteInk(store: DeckStore): void {
  store.setState((doc) => ({ inkEdits: doc.inkEdits + 1 }));
}

/** Takes what went into the file, not what's on screen now: edits can land while a Save runs. */
export function markSaved(store: DeckStore, slides: DeckSlide[], inkEdits: number): void {
  store.setState({ saved: slides, savedInk: inkEdits });
}
