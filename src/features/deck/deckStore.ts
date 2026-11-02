import { createStore } from "zustand";
import type { DeckSlide } from "../../lib/deck/slideOps";

/** One open presentation's slides and history (docs/ARCHITECTURE-DECKS.md §3). */

const MAX_HISTORY = 200;

/** What belongs to the whole presentation, not a slide. It's undone along with the slides. */
export interface DeckMeta {
  manifest: Record<string, unknown>;
  theme: string;
}

export interface DeckDoc {
  slides: DeckSlide[];
  meta: DeckMeta;
  past: DeckSlide[][];
  future: DeckSlide[][];
  pastMeta: DeckMeta[];
  futureMeta: DeckMeta[];
  savedMeta: DeckMeta;
  /** The list that's in the file. Undoing back to it means there's nothing to save. */
  saved: DeckSlide[] | null;
  /** Counted, so a stroke drawn while a Save is running still shows as unsaved afterwards. */
  inkEdits: number;
  savedInk: number;
}

export type DeckStore = ReturnType<typeof createDeckStore>;

/** `recovered` work isn't in the file yet, so it starts out unsaved. */
export function createDeckStore(
  slides: DeckSlide[],
  meta: DeckMeta = { manifest: {}, theme: "" },
  recovered = false,
) {
  return createStore<DeckDoc>(() => ({
    slides,
    meta,
    past: [],
    future: [],
    pastMeta: [],
    futureMeta: [],
    savedMeta: meta,
    saved: recovered ? null : slides,
    inkEdits: 0,
    savedInk: 0,
  }));
}

export function isDirty(doc: DeckDoc): boolean {
  return doc.inkEdits !== doc.savedInk || doc.slides !== doc.saved || doc.meta !== doc.savedMeta;
}

export function commit(store: DeckStore, slides: DeckSlide[], meta?: DeckMeta): void {
  store.setState((doc) => ({
    slides,
    meta: meta ?? doc.meta,
    past: [...doc.past, doc.slides].slice(-MAX_HISTORY),
    pastMeta: [...doc.pastMeta, doc.meta].slice(-MAX_HISTORY),
    future: [],
    futureMeta: [],
  }));
}

export function undo(store: DeckStore): DeckSlide[] | null {
  const { past, slides, future, pastMeta, futureMeta, meta } = store.getState();
  const previous = past[past.length - 1];
  if (!previous) return null;
  store.setState({
    slides: previous,
    meta: pastMeta[pastMeta.length - 1] ?? meta,
    past: past.slice(0, -1),
    pastMeta: pastMeta.slice(0, -1),
    future: [slides, ...future],
    futureMeta: [meta, ...futureMeta],
  });
  return previous;
}

export function redo(store: DeckStore): DeckSlide[] | null {
  const { past, slides, future, pastMeta, futureMeta, meta } = store.getState();
  const next = future[0];
  if (!next) return null;
  store.setState({
    slides: next,
    meta: futureMeta[0] ?? meta,
    past: [...past, slides],
    pastMeta: [...pastMeta, meta],
    future: future.slice(1),
    futureMeta: futureMeta.slice(1),
  });
  return next;
}

export function noteInk(store: DeckStore): void {
  store.setState((doc) => ({ inkEdits: doc.inkEdits + 1 }));
}

/** Takes what went into the file, not what's on screen now: edits can land while a Save runs. */
export function markSaved(
  store: DeckStore,
  slides: DeckSlide[],
  inkEdits: number,
  meta: DeckMeta,
): void {
  store.setState({ saved: slides, savedInk: inkEdits, savedMeta: meta });
}
