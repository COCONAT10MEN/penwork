import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { parseRuntimeMessage, type RuntimeMessage } from "../../lib/deck/bridge";
import { deckUrl } from "./openDeck";
import styles from "./RuntimeFrame.module.css";

export interface RuntimeFrameHandle {
  go: (slide: number) => void;
}

interface RuntimeFrameProps {
  token: string;
  title: string;
  onMessage: (message: RuntimeMessage) => void;
}

/**
 * The sandboxed slide page. No allow-same-origin: deck code can't reach the app, its files or
 * the internet. Anything it sends is checked in parseRuntimeMessage before the app uses it.
 */
export const RuntimeFrame = forwardRef<RuntimeFrameHandle, RuntimeFrameProps>(function RuntimeFrame(
  { token, title, onMessage },
  ref,
) {
  const frame = useRef<HTMLIFrameElement>(null);
  const handler = useRef(onMessage);
  useEffect(() => {
    handler.current = onMessage;
  });

  useImperativeHandle(ref, () => ({
    go: (slide) =>
      frame.current?.contentWindow?.postMessage(
        { v: 1, id: String(Date.now()), type: "go", payload: { slide } },
        "*",
      ),
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
      className={styles.frame}
      title={`Slides: ${title}`}
      sandbox="allow-scripts"
      src={deckUrl(token)}
    />
  );
});
