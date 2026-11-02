import { invoke, isTauri } from "@tauri-apps/api/core";
import { useCallback, useRef, useState, type RefObject } from "react";
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
  notesOf,
} from "../../lib/deck/slideOps";
import { changeElement, setElementHtml } from "../../lib/deck/slideEdit";
import { notify, showError, showWarning } from "../notices/notices";
import {
  commit,
  redo as redoStore,
  undo as undoStore,
  type DeckStore,
  type DeckMeta,
} from "./deckStore";
import type { OpenDeck } from "./openDeck";
import type { RuntimeFrameHandle } from "./RuntimeFrame";

type Frame = RefObject<RuntimeFrameHandle | null>;

const NOTHING_TO_SHOW = "At least one slide has to stay in the show.";
const IMAGES_NOT_COPIED = "Some images couldn't be copied with the slides.";

/** Lives outside any one presentation, so slides can be pasted into the next one opened. */
let copied: DeckSlide[] = [];
/** Their images, on the way to the app's clipboard. */
let copying: Promise<unknown> = Promise.resolve();

/** A show needs a slide to show, so the last visible one can't be hidden or deleted. */
function leavesNoShow(slides: readonly DeckSlide[]): boolean {
  return slides.every(isHidden);
}

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
  const [selected, setSelected] = useState<number[]>([start]);
  const shownMeta = useRef(store.getState().meta);

  /** Puts a list of slides on screen, in Rust too, so Save and a reload see the same thing. */
  const show = useCallback(
    (slides: DeckSlide[], focus: number, picked: number[], pick?: number) => {
      const html = joinSlides(slides);
      const slide = Math.max(0, Math.min(slides.length - 1, focus));
      const { meta } = store.getState();
      const newMeta = meta !== shownMeta.current;
      shownMeta.current = meta;
      const ready = !isTauri()
        ? Promise.resolve()
        : Promise.all([
            invoke("set_deck_slides", { token: deck.token, html }),
            invoke("set_deck_notes", { token: deck.token, notes: notesOf(slides) }),
            invoke("set_deck_meta", {
              token: deck.token,
              manifest: meta.manifest,
              theme: meta.theme,
            }),
          ]);
      // The pages read the theme from Rust, so it has to be there first.
      if (newMeta) {
        void ready.then(() => {
          const { lang, dir } = meta.manifest;
          for (const frame of [stage, sorter]) frame.current?.post("theme", { lang, dir });
        });
      }
      stage.current?.post("slides", { html, slide, pick });
      sorter.current?.post("slides", { html, slide });
      setSelected(picked);
      slideRef.current = slide;
      afterSync();
    },
    [deck.token, store, stage, sorter, slideRef, afterSync],
  );

  const edit = useCallback(
    (slides: DeckSlide[], focus: number, picked = [focus], pick?: number) => {
      commit(store, slides);
      show(slides, focus, picked, pick);
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
      showError(`A presentation can have up to ${MAX_SLIDES} slides.`);
      return false;
    },
    [store],
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
      const { manifest } = store.getState().meta;
      const html = layoutSlide(layout, brandOf(manifest, deck.manifest.title), at);
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
      // The menu greys this out, but the Delete key can still ask.
      const left = removeSlides(slides, picked);
      if (leavesNoShow(left)) {
        notify(
          left.length === 0 ? "A presentation needs at least one slide." : NOTHING_TO_SHOW,
          "info",
        );
        return;
      }
      edit(left, picked[0] ?? 0);
    },
    [store, pickedFor, edit],
  );

  const hide = useCallback(
    (slide?: number) => {
      const picked = pickedFor(slide);
      const toggled = toggleHidden(store.getState().slides, picked);
      if (leavesNoShow(toggled)) {
        notify(NOTHING_TO_SHOW, "info");
        return;
      }
      edit(toggled, slideRef.current, picked);
    },
    [store, pickedFor, edit, slideRef],
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
            if (failed.length > 0) showWarning(IMAGES_NOT_COPIED);
          },
          () => showWarning(IMAGES_NOT_COPIED),
        );
      }
      notify(
        copied.length === 1 ? "Slide copied" : `${copied.length} slides copied`,
        "content_copy",
      );
    },
    [deck.token, store, pickedFor],
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

  /** Typing on the slide finished. Only the element typed in changes, in the clean copy. */
  const setText = useCallback(
    (at: number, n: number, tag: string, html: string) => {
      const { slides } = store.getState();
      const slide = slides[at];
      const changed = slide ? setElementHtml(slide.html, n, tag, html) : null;
      if (!slide || changed === null) {
        notify("That edit couldn't be applied.", "info");
        // The page is showing what was typed, so it has to be put back.
        show(slides, at, [at]);
        return;
      }
      edit(
        slides.map((s, i) => (i === at ? { ...s, html: changed } : s)),
        at,
      );
    },
    [store, show, edit],
  );

  /** A change from the inspector to something on a slide. It stays picked afterwards. */
  const change = useCallback(
    (at: number, n: number, tag: string, how: (element: Element) => void, keep = true) => {
      const { slides } = store.getState();
      const slide = slides[at];
      const changed = slide ? changeElement(slide.html, n, tag, how) : null;
      if (!slide || changed === null) {
        notify("That change couldn't be applied.", "info");
        return;
      }
      edit(
        slides.map((s, i) => (i === at ? { ...s, html: changed } : s)),
        at,
        [at],
        keep ? n : undefined,
      );
    },
    [store, edit],
  );

  /** Presentation settings: one undo step, however many slides they touch. */
  const setMeta = useCallback(
    (meta: DeckMeta, slides: DeckSlide[]) => {
      commit(store, slides, meta);
      show(slides, slideRef.current, [slideRef.current]);
    },
    [store, show, slideRef],
  );

  /** An AI's reply, either in place of a slide or after it. Its styles join the theme. */
  const applyReply = useCallback(
    (at: number, html: string[], replace: boolean, css: string | null) => {
      const { slides, meta } = store.getState();
      const incoming = html.map((h) => withNewId({ id: "", html: h }));
      if (!fits(incoming.length - (replace ? 1 : 0))) return;
      const first = incoming[0];
      if (replace && first) incoming[0] = { ...first, notes: slides[at]?.notes };
      const next = [
        ...slides.slice(0, replace ? at : at + 1),
        ...incoming,
        ...slides.slice(at + 1),
      ];
      commit(store, next, css ? { ...meta, theme: `${meta.theme}\n${css}\n` } : meta);
      show(next, replace ? at : at + 1, [replace ? at : at + 1]);
    },
    [store, show, fits],
  );

  const setNotes = useCallback(
    (at: number, text: string) => {
      const { slides } = store.getState();
      const slide = slides[at];
      if (!slide) return;
      // Notes are filed by slide id, and a slide from an older file may not have one yet.
      const named = slide.id ? slide : withNewId(slide);
      edit(
        slides.map((s, i) => (i === at ? { ...named, notes: text } : s)),
        at,
      );
    },
    [store, edit],
  );

  const pick = useCallback(
    (slide: number, keys: { ctrl: boolean; shift: boolean }) => {
      setSelected((now) => nextSelection(now, slideRef.current, slide, keys));
      if (!keys.ctrl && !keys.shift) stage.current?.post("go", { slide });
    },
    [stage, slideRef],
  );

  const canRemove = useCallback(
    () => !leavesNoShow(removeSlides(store.getState().slides, selected)),
    [store, selected],
  );
  const canHide = useCallback(
    () => !leavesNoShow(toggleHidden(store.getState().slides, selected)),
    [store, selected],
  );

  return {
    selected,
    canRemove,
    canHide,
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
    setText,
    change,
    setNotes,
    setMeta,
    applyReply,
    hasCopied: () => copied.length > 0,
  };
}
