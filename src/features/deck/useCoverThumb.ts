import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useApp } from "../../appStore";
import type { OpenDeck } from "./openDeck";
import type { RuntimeFrameHandle } from "./RuntimeFrame";
import { captureThumb } from "./thumbnail";

// Long enough for the first slide to have stayed on screen, so moving on can't catch another.
const STAYED_MS = 500;
// The slide has to finish fading in, or the picture is caught part-way through.
const FADED_IN_MS = 300;

/** Keeps the picture of the first slide that Home shows for this presentation. */
export function useCoverThumb(deck: OpenDeck, stage: RefObject<RuntimeFrameHandle | null>) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const entry = useCallback(() => {
    const key = deck.path.toLowerCase();
    return useApp.getState().library.decks.find((d) => d.path.toLowerCase() === key);
  }, [deck.path]);

  const stale = useCallback(() => {
    const found = entry();
    return found !== undefined && found.thumb !== deck.stamp;
  }, [entry, deck.stamp]);

  const capture = useCallback(async () => {
    const found = entry();
    const rect = stage.current?.rect();
    // A dialog over the slide would end up in the picture.
    if (!found || !rect || document.querySelector("dialog[open]")) return;
    if (await captureThumb(rect, found.id)) useApp.getState().thumbSaved(found.id, deck.stamp);
  }, [entry, stage, deck.stamp]);

  /** Call whenever the slide changes. */
  const slideShown = useCallback(
    (shown: number, presenting: boolean) => {
      clearTimeout(timer.current);
      if (shown !== 0 || presenting || !stale()) return;
      timer.current = setTimeout(() => void capture(), STAYED_MS);
    },
    [stale, capture],
  );

  /** For a presentation opening part-way through: the first slide is on screen just for this. */
  const takeNow = useCallback(async () => {
    await new Promise((done) => setTimeout(done, FADED_IN_MS));
    await capture();
  }, [capture]);

  return { stale, slideShown, takeNow };
}
