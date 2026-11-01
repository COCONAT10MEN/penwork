import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { useSettings } from "../settings/settingsStore";
import type { RuntimeFrameHandle } from "./RuntimeFrame";

function setFullscreen(on: boolean): Promise<void> {
  return isTauri() ? getCurrentWindow().setFullscreen(on) : Promise.resolve();
}

function modeMessage(mode: "edit" | "present", from: number) {
  const { reduceMotion, endOfShow } = useSettings.getState().settings;
  return { mode, slide: from, reduced: reduceMotion, loop: endOfShow === "loop" };
}

const afterLayout = () =>
  new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));

/** The slide's frame, full window size, drawn over its place in the edit view. */
function inSlot(slot: DOMRect): Keyframe {
  const scale = slot.width / window.innerWidth;
  const y = slot.top + (slot.height - window.innerHeight * scale) / 2;
  return {
    transform: `translate(${slot.left}px, ${y}px) scale(${scale})`,
    borderRadius: `${10 / scale}px`,
  };
}

/**
 * Glides the frame between its place and the whole window, on the spring for full-screen moves.
 * The window itself jumps, so that happens first and this plays out inside it.
 */
function glide(frame: HTMLElement, slot: DOMRect, to: "full" | "slot"): Animation | null {
  const motion = getComputedStyle(document.documentElement);
  const duration = parseFloat(motion.getPropertyValue("--md-sys-motion-spatial-slow-duration"));
  if (!duration) return null;
  const full = { transform: "none", borderRadius: "0px" };
  return frame.animate(to === "full" ? [inSlot(slot), full] : [full, inSlot(slot)], {
    duration,
    easing: motion.getPropertyValue("--md-sys-motion-spatial-slow-easing"),
    fill: "forwards",
  });
}

/** Starting and ending the full-screen show. */
export function useShow(
  stage: RefObject<RuntimeFrameHandle | null>,
  latestSlide: RefObject<number>,
  presentOnOpen: boolean,
) {
  const [presenting, setPresenting] = useState(presentOnOpen);
  // The frame is out of the layout. It stays out after a show ends, until it has glided back.
  const [lifted, setLifted] = useState(presentOnOpen);
  const isLifted = useRef(presentOnOpen);
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
      // The show starts once the window is full size, so its opening isn't seen at the old size.
      void setFullscreen(true)
        .then(afterLayout)
        .then(() => {
          const frame = stage.current?.element();
          const slot = frame?.parentElement?.getBoundingClientRect();
          const rise = !isLifted.current;
          isLifted.current = true;
          flushSync(() => {
            setPresenting(true);
            setLifted(true);
          });
          stage.current?.post("mode", modeMessage("present", from));
          stage.current?.focus();
          const moving = rise && frame && slot ? glide(frame, slot, "full") : null;
          void moving?.finished.then(() => moving.cancel()).catch(() => {});
        });
    },
    [stage],
  );

  const endShow = useCallback(() => {
    showing.current = false;
    stage.current?.post("mode", modeMessage("edit", latestSlide.current));
    void setFullscreen(false)
      .then(afterLayout)
      .then(async () => {
        const frame = stage.current?.element();
        const slot = frame?.parentElement?.getBoundingClientRect();
        setPresenting(false);
        const moving = frame && slot ? glide(frame, slot, "slot") : null;
        await moving?.finished.catch(() => {});
        isLifted.current = false;
        flushSync(() => setLifted(false));
        moving?.cancel();
      });
  }, [stage, latestSlide]);

  // A show must not leave the window full screen if the app moves on without ending it.
  useEffect(() => {
    if (presentOnOpen) void setFullscreen(true);
    return () => void setFullscreen(false);
  }, [presentOnOpen]);

  return { presenting, lifted, present, endShow, modeMessage, showing, presentButton };
}
