import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";

/** The whole screen for a document, from the bar's button or F11. Esc leaves it too. */
export function useFullScreen() {
  const [on, setOn] = useState(false);

  const set = useCallback((next: boolean) => {
    if (!isTauri()) return;
    void getCurrentWindow()
      .setFullscreen(next)
      .then(() => setOn(next));
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    const window = getCurrentWindow();
    // Windows can leave full screen by itself, so the button follows the window, not a guess.
    const stop = window.onResized(() => void window.isFullscreen().then(setOn));
    return () => void stop.then((unlisten) => unlisten());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        set(!on);
      } else if (e.key === "Escape" && on && !document.querySelector("dialog[open]")) {
        set(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, set]);

  // Leaving the document leaves full screen with it.
  useEffect(() => () => set(false), [set]);

  return { on, toggle: () => set(!on) };
}
