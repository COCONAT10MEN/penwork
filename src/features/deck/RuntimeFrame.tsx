import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { parseRuntimeMessage, type RuntimeMessage } from "../../lib/deck/bridge";
import { cx } from "../../ui/cx";
import { deckUrl } from "./openDeck";
import styles from "./RuntimeFrame.module.css";

export interface RuntimeFrameHandle {
  /** Sends a command to the slide page. Its meaning is in the glue at the end of engine.js. */
  post: (type: string, payload?: object) => void;
  focus: () => void;
  /** Where the slide page is on screen, for cropping a thumbnail. */
  rect: () => DOMRect | null;
}

interface RuntimeFrameProps {
  token: string;
  title: string;
  /** The slide itself, or the column of thumbnails beside it in the edit view. */
  view?: "stage" | "sorter";
  className?: string;
  onMessage: (message: RuntimeMessage) => void;
}

/**
 * The sandboxed slide page. No allow-same-origin: deck code can't reach the app, its files or
 * the internet. Anything it sends is checked in parseRuntimeMessage before the app uses it.
 */
export const RuntimeFrame = forwardRef<RuntimeFrameHandle, RuntimeFrameProps>(function RuntimeFrame(
  { token, title, view = "stage", className, onMessage },
  ref,
) {
  const frame = useRef<HTMLIFrameElement>(null);
  const handler = useRef(onMessage);
  useEffect(() => {
    handler.current = onMessage;
  });

  useImperativeHandle(ref, () => ({
    post: (type, payload = {}) =>
      frame.current?.contentWindow?.postMessage(
        { v: 1, id: String(Date.now()), type, payload },
        "*",
      ),
    focus: () => frame.current?.focus(),
    rect: () => frame.current?.getBoundingClientRect() ?? null,
  }));

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      // Only this iframe. A sandboxed page has the origin "null", so origin can't identify it.
      if (event.source !== frame.current?.contentWindow) return;
      const message = parseRuntimeMessage(event.data);
      if (message) handler.current(message);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  return (
    <iframe
      ref={frame}
      className={cx(styles.frame, className)}
      title={view === "sorter" ? `Slide list: ${title}` : `Slides: ${title}`}
      sandbox="allow-scripts"
      src={deckUrl(token, view)}
    />
  );
});
