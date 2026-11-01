import { invoke, isTauri } from "@tauri-apps/api/core";
import { useCallback, useState, type RefObject } from "react";
import { brandOf, layoutSlide, type SlideLayout } from "../../lib/deck/layouts";
import { sanitizeSlides } from "../../lib/deck/sanitize";
import {
  assetNames,
  insertAt,
  joinSlides,
  moveSlides,
  nextSelection,
  nudgeSlides,
  removeSlides,
  splitSlides,
  toggleHidden,
  withNewId,
  type DeckSlide,
} from "../../lib/deck/slideOps";
import { useSnackbar } from "../../ui";
import { commit, redo as redoStore, undo as undoStore, type DeckStore } from "./deckStore";
import type { OpenDeck } from "./openDeck";
import type { RuntimeFrameHandle } from "./RuntimeFrame";

type Frame = RefObject<RuntimeFrameHandle | null>;

/** Lives outside any one presentation, so slides can be pasted into the next one opened. */
let copied: DeckSlide[] = [];

export function useSlideEditing(options: {
  deck: OpenDeck;
  store: DeckStore;
  stage: Frame;
  sorter: Frame;
  start: number;
  slideRef: RefObject<number>;
  /** Called after the page has new slides, as ink is matched to them by slide id. */
  afterSync: () => void;
}) {
  const { deck, store, stage, sorter, start, slideRef, afterSync } = options;
  const notify = useSnackbar();
  const [selected, setSelected] = useState<number[]>([start]);

  /** Puts a list of slides on screen, in Rust too, so Save and a reload see the same thing. */
  const show = useCallback(
    (slides: DeckSlide[], focus: number, picked: number[]) => {
      const html = joinSlides(slides);
      const slide = Math.max(0, Math.min(slides.length - 1, focus));
      if (isTauri()) void invoke("set_deck_slides", { token: deck.token, html });
      stage.current?.post("slides", { html, slide });
      sorter.current?.post("slides", { html, slide });
      setSelected(picked);
      slideRef.current = slide;
      afterSync();
    },
    [deck.token, stage, sorter, slideRef, afterSync],
  );

  const edit = useCallback(
    (slides: DeckSlide[], focus: number, picked = [focus]) => {
      commit(store, slides);
      show(slides, focus, picked);
    },
    [store, show],
  );

  const undo = useCallback(() => {
    const slides = undoStore(store);
    if (slides) show(slides, slideRef.current, [Math.min(slideRef.current, slides.length - 1)]);
  }, [store, show, slideRef]);

  const redo = useCallback(() => {
    const slides = redoStore(store);
    if (slides) show(slides, slideRef.current, [Math.min(slideRef.current, slides.length - 1)]);
  }, [store, show, slideRef]);

  /** The slides an action applies to: the selection, or the one right-clicked outside it. */
  const pickedFor = useCallback(
    (slide?: number) => {
      const list = slide === undefined || selected.includes(slide) ? selected : [slide];
      return [...list].sort((a, b) => a - b);
    },
    [selected],
  );

  const add = useCallback(
    (layout: SlideLayout) => {
      const { slides } = store.getState();
      const at = slideRef.current + 1;
      const html = layoutSlide(layout, brandOf(deck.manifest.raw, deck.manifest.title), at);
      const added = splitSlides(sanitizeSlides(html).html).map(withNewId);
      edit(insertAt(slides, at, added), at);
    },
    [deck.manifest, store, slideRef, edit],
  );

  const duplicate = useCallback(
    (slide?: number) => {
      const { slides } = store.getState();
      const picked = pickedFor(slide);
      const at = (picked[picked.length - 1] ?? 0) + 1;
      const copies = picked.flatMap((i) => {
        const original = slides[i];
        return original ? [withNewId(original)] : [];
      });
      edit(
        insertAt(slides, at, copies),
        at,
        copies.map((_, i) => at + i),
      );
    },
    [store, pickedFor, edit],
  );

  const remove = useCallback(
    (slide?: number) => {
      const { slides } = store.getState();
      const picked = pickedFor(slide);
      if (picked.length >= slides.length) {
        notify({ message: "A presentation needs at least one slide." });
        return;
      }
      edit(removeSlides(slides, picked), picked[0] ?? 0);
    },
    [store, pickedFor, edit, notify],
  );

  const hide = useCallback(
    (slide?: number) => {
      const picked = pickedFor(slide);
      edit(toggleHidden(store.getState().slides, picked), slideRef.current, picked);
    },
    [store, pickedFor, edit, slideRef],
  );

  const move = useCallback(
    (slide: number, to: number) => {
      const picked = pickedFor(slide);
      const moved = moveSlides(store.getState().slides, picked, to);
      const places = picked.map((_, i) => moved.first + i);
      edit(moved.slides, moved.first, places);
    },
    [store, pickedFor, edit],
  );

  const nudge = useCallback(
    (direction: -1 | 1) => {
      const picked = pickedFor();
      const moved = nudgeSlides(store.getState().slides, picked, direction);
      if (!moved) return;
      const places = picked.map((_, i) => moved.first + i);
      edit(moved.slides, moved.first, places);
    },
    [store, pickedFor, edit],
  );

  const copy = useCallback(
    (slide?: number) => {
      const { slides } = store.getState();
      copied = pickedFor(slide).flatMap((i) => {
        const original = slides[i];
        return original ? [original] : [];
      });
      if (isTauri()) {
        void invoke("copy_slide_assets", { token: deck.token, names: assetNames(copied) });
      }
      notify({
        message: copied.length === 1 ? "Slide copied." : `${copied.length} slides copied.`,
      });
    },
    [deck.token, store, pickedFor, notify],
  );

  const paste = useCallback(async () => {
    if (copied.length === 0) return;
    if (isTauri()) await invoke("paste_slide_assets", { token: deck.token });
    const at = slideRef.current + 1;
    const added = copied.map(withNewId);
    edit(
      insertAt(store.getState().slides, at, added),
      at,
      added.map((_, i) => at + i),
    );
  }, [deck.token, store, slideRef, edit]);

  const pick = useCallback(
    (slide: number, keys: { ctrl: boolean; shift: boolean }) => {
      setSelected((now) => nextSelection(now, slideRef.current, slide, keys));
      if (!keys.ctrl && !keys.shift) stage.current?.post("go", { slide });
    },
    [stage, slideRef],
  );

  return {
    selected,
    setSelected,
    undo,
    redo,
    add,
    duplicate,
    remove,
    hide,
    move,
    nudge,
    copy,
    paste,
    pick,
    hasCopied: () => copied.length > 0,
  };
}
