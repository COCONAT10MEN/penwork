import { describe, expect, it } from "vitest";
import { commit, createDeckStore, isDirty, markSaved, noteInk, redo, undo } from "./deckStore";

const list = (id: string) => [{ id, html: `<section data-id="${id}"></section>` }];

describe("deck history", () => {
  it("starts with nothing to save", () => {
    expect(isDirty(createDeckStore(list("a")).getState())).toBe(false);
  });

  it("starts unsaved when it was recovered", () => {
    expect(isDirty(createDeckStore(list("a"), undefined, true).getState())).toBe(true);
  });

  it("undoes and redoes", () => {
    const store = createDeckStore(list("a"));
    commit(store, list("b"));
    commit(store, list("c"));
    expect(undo(store)?.[0]?.id).toBe("b");
    expect(undo(store)?.[0]?.id).toBe("a");
    expect(undo(store)).toBeNull();
    expect(redo(store)?.[0]?.id).toBe("b");
    expect(redo(store)?.[0]?.id).toBe("c");
    expect(redo(store)).toBeNull();
  });

  it("drops redo after a new edit", () => {
    const store = createDeckStore(list("a"));
    commit(store, list("b"));
    undo(store);
    commit(store, list("c"));
    expect(redo(store)).toBeNull();
  });

  it("knows when undo gets back to what's in the file", () => {
    const store = createDeckStore(list("a"));
    commit(store, list("b"));
    expect(isDirty(store.getState())).toBe(true);
    undo(store);
    expect(isDirty(store.getState())).toBe(false);
  });

  it("stays unsaved when undoing past a save", () => {
    const store = createDeckStore(list("a"));
    commit(store, list("b"));
    markSaved(store, store.getState().slides, 0, store.getState().meta);
    expect(isDirty(store.getState())).toBe(false);
    undo(store);
    expect(isDirty(store.getState())).toBe(true);
  });

  it("counts changed ink as unsaved", () => {
    const store = createDeckStore(list("a"));
    noteInk(store);
    expect(isDirty(store.getState())).toBe(true);
    markSaved(store, store.getState().slides, 1, store.getState().meta);
    expect(isDirty(store.getState())).toBe(false);
  });

  it("stays unsaved when an edit lands during a save", () => {
    const store = createDeckStore(list("a"));
    commit(store, list("b"));
    const inFile = store.getState().slides;
    commit(store, list("c"));
    noteInk(store);
    markSaved(store, inFile, 0, store.getState().meta);
    expect(isDirty(store.getState())).toBe(true);
    undo(store);
    expect(isDirty(store.getState())).toBe(true); // the ink still isn't in the file
  });

  it("keeps 200 steps", () => {
    const store = createDeckStore(list("a"));
    for (let i = 0; i < 250; i++) commit(store, list(`n${i}`));
    expect(store.getState().past).toHaveLength(200);
  });
});
