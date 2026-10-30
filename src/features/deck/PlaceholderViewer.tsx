import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../../appStore";
import type { RuntimeMessage } from "../../lib/deck/bridge";
import { IconButton, TopAppBar } from "../../ui";
import type { OpenDeck } from "./openDeck";
import { RuntimeFrame, type RuntimeFrameHandle } from "./RuntimeFrame";
import styles from "./PlaceholderViewer.module.css";

/** A simple way to look through a deck until Present arrives in M3. */
export function PlaceholderViewer({ deck, start }: { deck: OpenDeck; start: number }) {
  const closeDeck = useApp((s) => s.closeDeck);
  const rememberSlide = useApp((s) => s.rememberSlide);
  const frame = useRef<RuntimeFrameHandle>(null);
  const [slide, setSlide] = useState(0);
  const [total, setTotal] = useState(deck.slideCount);

  const go = useCallback(
    (next: number) => {
      if (next >= 0 && next < total) frame.current?.go(next);
    },
    [total],
  );

  const onKey = useCallback(
    (key: string) => {
      if (key === "ArrowRight" || key === "PageDown" || key === " ") go(slide + 1);
      else if (key === "ArrowLeft" || key === "PageUp") go(slide - 1);
      else if (key === "Home") go(0);
      else if (key === "End") go(total - 1);
      else if (key === "Escape") closeDeck();
    },
    [go, slide, total, closeDeck],
  );

  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e.key);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onKey]);

  const onMessage = (message: RuntimeMessage) => {
    if (message.type === "ready") {
      setTotal(message.total);
      if (start > 0) frame.current?.go(Math.min(start, message.total - 1));
    } else if (message.type === "state") {
      setSlide(message.slide);
      setTotal(message.total);
      rememberSlide(message.slide);
    } else if (message.type === "key" && !message.ctrl && !message.alt) {
      onKey(message.key);
    }
  };

  return (
    <div className={styles.viewer}>
      <TopAppBar
        title={deck.manifest.title}
        subtitle={`Slide ${slide + 1} of ${total}`}
        leading={<IconButton icon="arrow_back" label="Back to Home" onClick={closeDeck} />}
        actions={
          <>
            <IconButton
              icon="chevron_left"
              label="Previous slide"
              disabled={slide === 0}
              onClick={() => go(slide - 1)}
            />
            <IconButton
              icon="chevron_right"
              label="Next slide"
              disabled={slide >= total - 1}
              onClick={() => go(slide + 1)}
            />
          </>
        }
      />
      <div className={styles.stage}>
        <RuntimeFrame
          ref={frame}
          token={deck.token}
          title={deck.manifest.title}
          onMessage={onMessage}
        />
      </div>
    </div>
  );
}
