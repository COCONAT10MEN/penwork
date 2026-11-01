import { useCallback, useEffect, type RefObject } from "react";
import type { RuntimeFrameHandle } from "./RuntimeFrame";
import type { useSlideEditing } from "./useSlideEditing";

export interface KeyPress {
  key: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
}

/** Typing in a dialog or picking from a menu is doing just that, not using a shortcut. */
const BUSY = 'dialog[open], [role="menu"]';

/** The keyboard, wherever focus is: here in the app, or inside one of the two slide pages. */
export function useEditKeys(options: {
  presenting: boolean;
  stage: RefObject<RuntimeFrameHandle | null>;
  slide: number;
  total: number;
  present: (from: number) => void;
  endShow: () => void;
  showSlide: (slide: number) => void;
  editing: ReturnType<typeof useSlideEditing>;
  save: (saveAs?: boolean) => Promise<boolean>;
}): (press: KeyPress) => void {
  const { presenting, stage, slide, total, present, endShow, showSlide, editing, save } = options;

  const onKey = useCallback(
    ({ key, shift, ctrl, alt }: KeyPress) => {
      if (document.querySelector(BUSY)) return;
      if (key === "F5") {
        if (!presenting) present(shift ? slide : 0);
      } else if (presenting) {
        if (key === "Escape") endShow();
      } else if (ctrl) {
        const letter = key.toLowerCase();
        if (letter === "z") (shift ? editing.redo : editing.undo)();
        else if (letter === "y") editing.redo();
        else if (letter === "s") void save(shift);
        else if (letter === "e") present(slide);
        else if (letter === "d") editing.duplicate();
        else if (letter === "c") editing.copy();
        else if (letter === "v") void editing.paste();
      } else if (alt) {
        if (key === "ArrowUp") editing.nudge(-1);
        else if (key === "ArrowDown") editing.nudge(1);
      } else if (key === "Delete") {
        editing.remove();
      } else if (key === "ArrowRight" || key === "ArrowDown" || key === "PageDown") {
        showSlide(slide + 1);
      } else if (key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp") {
        showSlide(slide - 1);
      } else if (key === "Home") {
        showSlide(0);
      } else if (key === "End") {
        showSlide(total - 1);
      }
    },
    [presenting, present, endShow, showSlide, editing, save, slide, total],
  );

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      // F5 and Ctrl+S would otherwise reach the browser underneath the app.
      if (e.key === "F5" || (e.ctrlKey && "sde".includes(e.key.toLowerCase()))) e.preventDefault();
      if (document.querySelector(BUSY)) return;
      // During a show the slide page owns the keys, even if focus has landed out here.
      if (presenting) {
        stage.current?.post("key", {
          key: e.key,
          shift: e.shiftKey,
          ctrl: e.ctrlKey,
          alt: e.altKey,
        });
        return;
      }
      onKey({ key: e.key, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey });
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onKey, presenting, stage]);

  return onKey;
}
