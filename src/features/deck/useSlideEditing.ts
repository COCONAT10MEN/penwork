import { invoke, isTauri } from "@tauri-apps/api/core";
import { useCallback, useState, type RefObject } from "react";
import { brandOf, layoutSlide, type SlideLayout } from "../../lib/deck/layouts";
import { sanitizeSlides } from "../../lib/deck/sanitize";
import {
  assetNames,
  insertAt,
  isHidden,
  joinSlides,
  MAX_SLIDES,
  moveSlides,
  nextSelection,
  nudgeSlides,
  removeSlides,
  renameAssets,
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

const NOTHING_TO_SHOW = "At least one slide has to stay in the show.";
const IMAGES_NOT_COPIED = "Some images couldn't be copied with the slides.";

/** Lives outside any one presentation, so slides can be pasted into the next one opened. */
let copied: DeckSlide[] = [];
/** Their images, on the way to the app's clipboard. */
let copying: Promise<unknown> = Promise.resolve();

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

  /** Stays on the same slide, wherever the step moved it. */
  const step = useCallback(
    (go: (doc: DeckStore) => DeckSlide[] | null) => {
      const id = store.getState().slides[slideRef.current]?.id;
      const slides = go(store);
      if (!slides) return;
      const at = slides.findIndex((slide) => slide.id === id);
      const focus = at >= 0 ? at : Math.min(slideRef.current, slides.length - 1);
      show(slides, focus, [focus]);
    },
    [store, show, slideRef],
  );
  const undo = useCallback(() => step(undoStore), [step]);
  const redo = useCallback(() => step(redoStore), [step]);

  /** Saving past the limit would make a file Penwork refuses to open. */
  const fits = useCallback(
    (adding: number) => {
      if (store.getState().slides.length + adding <= MAX_SLIDES) return true;
      notify({ message: `A presentation can have up to ${MAX_SLIDES} slides.` });
      return false;
    },
    [store, notify],
  );

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
      if (!fits(1)) return;
      const { slides } = store.getState();
      const at = slideRef.current + 1;
      const html = layoutSlide(layout, brandOf(deck.manifest.raw, deck.manifest.title), at);
      const added = splitSlides(sanitizeSlides(html).html).map(withNewId);
      edit(insertAt(slides, at, added), at);
    },
    [deck.manifest, store, slideRef, edit, fits],
  );

  const duplicate = useCallback(
    (slide?: number) => {
      const { slides } = store.getState();
      const picked = pickedFor(slide);
      if (!fits(picked.length)) return;
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
    [store, pickedFor, edit, fits],
  );

  const remove = useCallback(
    (slide?: number) => {
      const { slides } = store.getState();
      const picked = pickedFor(slide);
      if (picked.length >= slides.length) {
        notify({ message: "A presentation needs at least one slide." });
        return;
      }
      const left = removeSlides(slides, picked);
      if (left.every(isHidden)) {
        notify({ message: NOTHING_TO_SHOW });
        return;
      }
      edit(left, picked[0] ?? 0);
    },
    [store, pickedFor, edit, notify],
  );

  const hide = useCallback(
    (slide?: number) => {
      const picked = pickedFor(slide);
      const toggled = toggleHidden(store.getState().slides, picked);
      if (toggled.every(isHidden)) {
        notify({ message: NOTHING_TO_SHOW });
        return;
      }
      edit(toggled, slideRef.current, picked);
    },
    [store, pickedFor, edit, slideRef, notify],
  );

  const move = useCallback(
    (slide: number, to: number) => {
      const picked = pickedFor(slide);
      const { slides } = store.getState();
      const moved = moveSlides(slides, picked, to);
      // Dropped where it already was: nothing to undo.
      if (moved.slides.every((s, i) => s === slides[i])) return;
      const places = picked.map((_, i) => moved.first + i);
      edit(moved.slides, moved.first, places);
    },
    [store, pickedFor, edit],
  );

  const nudge = useCallback(
    (direction: -1 | 1, slide?: number) => {
      const picked = pickedFor(slide);
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
        copying = invoke<string[]>("copy_slide_assets", {
          token: deck.token,
          names: assetNames(copied),
        }).then(
          (failed) => {
            if (failed.length > 0) notify({ message: IMAGES_NOT_COPIED });
          },
          () => notify({ message: IMAGES_NOT_COPIED }),
        );
      }
      notify({
        message: copied.length === 1 ? "Slide copied." : `${copied.length} slides copied.`,
      });
    },
    [deck.token, store, pickedFor, notify],
  );

  const paste = useCallback(
    async (after?: number) => {
      if (copied.length === 0 || !fits(copied.length)) return;
      await copying;
      const renames = isTauri()
        ? await invoke<[string, string][]>("paste_slide_assets", { token: deck.token })
        : [];
      const at = (after ?? slideRef.current) + 1;
      const added = renameAssets(copied, renames).map(withNewId);
      edit(
        insertAt(store.getState().slides, at, added),
        at,
        added.map((_, i) => at + i),
      );
    },
    [deck.token, store, slideRef, edit, fits],
  );

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
