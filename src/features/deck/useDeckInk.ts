import { useCallback, useRef, useState, type RefObject } from "react";
import { hasInk, readInk, readStrokes, type InkBySlide } from "../../lib/deck/ink";
import type { DeckSlide } from "../../lib/deck/slideOps";
import type { OpenDeck } from "./openDeck";
import type { RuntimeFrameHandle } from "./RuntimeFrame";

type Frame = RefObject<RuntimeFrameHandle | null>;

/** A presentation's ink. Like the slides, it reaches the file on Save and only then. */
export function useDeckInk(deck: OpenDeck, sorter: Frame, onChanged: () => void) {
  const [fromFile] = useState<InkBySlide>(() => readInk(deck.ink));
  const ink = useRef(fromFile);

  const send = useCallback((frame: Frame) => {
    frame.current?.post("ink", { slides: ink.current });
  }, []);

  const changed = useCallback(
    (slide: string, strokes: unknown) => {
      const clean = readStrokes(strokes);
      ink.current = { ...ink.current, [slide]: clean };
      onChanged();
      sorter.current?.post("ink", { slides: { [slide]: clean } });
    },
    [sorter, onChanged],
  );

  /**
   * What goes into ink.json. A deleted slide's ink stays here, as undo can bring the slide back,
   * but it doesn't go into the file.
   */
  const file = useCallback((slides: readonly DeckSlide[]) => {
    const ids = new Set(slides.map((slide) => slide.id));
    const kept = Object.fromEntries(
      Object.entries(ink.current).filter(([id]) => id === "wb" || ids.has(id)),
    );
    return hasInk(kept) ? { version: 1 as const, slides: kept } : null;
  }, []);

  return { send, changed, file };
}
