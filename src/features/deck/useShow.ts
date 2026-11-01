import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useSettings } from "../settings/settingsStore";
import type { RuntimeFrameHandle } from "./RuntimeFrame";

function setFullscreen(on: boolean): Promise<void> {
  return isTauri() ? getCurrentWindow().setFullscreen(on) : Promise.resolve();
}

function modeMessage(mode: "edit" | "present", from: number) {
  const { reduceMotion, endOfShow } = useSettings.getState().settings;
  return { mode, slide: from, reduced: reduceMotion, loop: endOfShow === "loop" };
}

/** Starting and ending the full-screen show. */
export function useShow(
  stage: RefObject<RuntimeFrameHandle | null>,
  latestSlide: RefObject<number>,
  presentOnOpen: boolean,
) {
  const [presenting, setPresenting] = useState(presentOnOpen);
  // For code that runs outside a render: a show can start while the page is still being set up.
  const showing = useRef(presentOnOpen);
  const presentButton = useRef<HTMLButtonElement>(null);
  const wasPresenting = useRef(presenting);

  // The button that ended the show is gone, so focus needs somewhere sensible to land.
  useEffect(() => {
    if (wasPresenting.current && !presenting) presentButton.current?.focus();
    wasPresenting.current = presenting;
  }, [presenting]);

  const present = useCallback(
    (from: number) => {
      showing.current = true;
      setPresenting(true);
      // The show starts once the window is full size, so its opening isn't seen at the old size.
      void setFullscreen(true).then(() => {
        stage.current?.post("mode", modeMessage("present", from));
        stage.current?.focus();
      });
    },
    [stage],
  );

  const endShow = useCallback(() => {
    showing.current = false;
    stage.current?.post("mode", modeMessage("edit", latestSlide.current));
    setPresenting(false);
    void setFullscreen(false);
  }, [stage, latestSlide]);

  // A show must not leave the window full screen if the app moves on without ending it.
  useEffect(() => {
    if (presentOnOpen) void setFullscreen(true);
    return () => void setFullscreen(false);
  }, [presentOnOpen]);

  return { presenting, present, endShow, modeMessage, showing, presentButton };
}
