import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { useSettings } from "../settings/settingsStore";
import type { RuntimeFrameHandle } from "./RuntimeFrame";
import {
  frameSize,
  glide,
  pageOrigin,
  setPlace,
  shifted,
  slotPlace,
  stopMoving,
  windowPlace,
  type Place,
} from "./stagePlace";

const SLOT_CORNER = 10;
// A window that was already that size never says it changed.
const RESIZE_LIMIT_MS = 900;
const RESIZE_QUIET_MS = 90;

function setFullscreen(on: boolean): Promise<void> {
  return isTauri() ? getCurrentWindow().setFullscreen(on) : Promise.resolve();
}

/**
 * Windows changes the window in steps, and nothing can be drawn while it does. Each step calls
 * `hold`, which keeps the slide where it was on the screen. Comes back when the window has settled.
 */
function windowBecomes(on: boolean, hold: () => void): Promise<void> {
  return new Promise((done) => {
    let quiet: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(limit);
      clearTimeout(quiet);
      window.removeEventListener("resize", step);
      done();
    };
    const step = () => {
      hold();
      const { width, height } = frameSize();
      if (on && window.innerWidth >= width && window.innerHeight >= height) {
        finish();
        return;
      }
      clearTimeout(quiet);
      quiet = setTimeout(finish, RESIZE_QUIET_MS);
    };
    const limit = setTimeout(finish, RESIZE_LIMIT_MS);
    window.addEventListener("resize", step);
    void setFullscreen(on);
  });
}

function modeMessage(mode: "edit" | "present", from: number) {
  const { reduceMotion, endOfShow } = useSettings.getState().settings;
  return { mode, slide: from, reduced: reduceMotion, loop: endOfShow === "loop" };
}

function restingPlace(lifted: boolean, slot: HTMLElement | null): Place | null {
  if (lifted) return windowPlace();
  return slot ? slotPlace(slot.getBoundingClientRect(), SLOT_CORNER) : null;
}

type Play = (animation: Animation | null) => Promise<void>;

/**
 * All of the big move happens inside the window, where it's smooth. Then comes the one pause that
 * can't be avoided, while Windows goes full screen, with the slide at rest so it doesn't show as a
 * stutter. It then eases out to the edges from exactly where it stopped.
 */
async function growToFull(
  frame: HTMLElement,
  start: Place | null,
  play: Play,
  block: (on: boolean) => void,
  current: () => boolean,
): Promise<void> {
  block(true);
  if (start) await play(glide(frame, start, windowPlace(), "spatial-default"));
  if (!current()) return;
  const before = windowPlace();
  const origin = pageOrigin();
  await windowBecomes(true, () => setPlace(frame, shifted(before, origin)));
  if (!current()) return;
  await play(glide(frame, shifted(before, origin), windowPlace(), "effects-default"));
  block(false);
}

/** Starting and ending the full-screen show. */
export function useShow(
  stage: RefObject<RuntimeFrameHandle | null>,
  slot: RefObject<HTMLElement | null>,
  latestSlide: RefObject<number>,
  presentOnOpen: boolean,
) {
  const [presenting, setPresenting] = useState(presentOnOpen);
  // Out of the layout. It stays out after a show ends, until it has glided back.
  const [lifted, setLifted] = useState(presentOnOpen);
  const isLifted = useRef(presentOnOpen);
  // For code that runs outside a render: a show can start while the page is still being set up.
  const showing = useRef(presentOnOpen);
  const presentButton = useRef<HTMLButtonElement>(null);
  const wasPresenting = useRef(presenting);
  // Each move cancels whatever is still running, so a quick Esc can't leave it stranded.
  const move = useRef(0);
  const running = useRef<Animation | null>(null);
  const moving = useRef(false);

  // Follows the layout whenever nothing is moving it.
  useLayoutEffect(() => {
    const frame = stage.current?.element();
    const box = slot.current;
    if (!frame || !box) return;
    const fit = () => {
      if (moving.current) return;
      const size = frameSize();
      frame.style.width = `${size.width}px`;
      frame.style.height = `${size.height}px`;
      const now = restingPlace(isLifted.current, box);
      if (now) setPlace(frame, now);
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(box);
    window.addEventListener("resize", fit);
    return () => {
      watch.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [stage, slot]);

  const play = useCallback(async (animation: Animation | null) => {
    running.current = animation;
    await animation?.finished.catch(() => {});
    if (running.current === animation) running.current = null;
  }, []);

  // The button that ended the show is gone, so focus needs somewhere sensible to land.
  useEffect(() => {
    if (wasPresenting.current && !presenting) presentButton.current?.focus();
    wasPresenting.current = presenting;
  }, [presenting]);

  const present = (from: number) => {
    const frame = stage.current?.element();
    if (!frame) return;
    showing.current = true;
    const mine = ++move.current;
    const start = restingPlace(isLifted.current, slot.current);
    const rise = !isLifted.current;
    isLifted.current = true;
    stopMoving(frame);
    flushSync(() => {
      setPresenting(true);
      setLifted(true);
    });
    stage.current?.post("mode", modeMessage("present", from));
    stage.current?.focus();
    const block = (on: boolean) => {
      moving.current = on;
    };
    void growToFull(frame, rise ? start : null, play, block, () => mine === move.current);
  };

  const endShow = () => {
    const frame = stage.current?.element();
    if (!frame) return;
    showing.current = false;
    const mine = ++move.current;
    stopMoving(frame);
    moving.current = true;
    stage.current?.post("mode", modeMessage("edit", latestSlide.current));
    const before = windowPlace();
    const origin = pageOrigin();
    const back = async () => {
      flushSync(() => setPresenting(false));
      isLifted.current = false;
      const to = restingPlace(false, slot.current);
      if (to) await play(glide(frame, shifted(before, origin), to, "spatial-default"));
    };
    void windowBecomes(false, () => setPlace(frame, shifted(before, origin)))
      .then(() => (mine === move.current ? back() : undefined))
      .then(() => {
        if (mine !== move.current) return;
        moving.current = false;
        setLifted(false);
      });
  };

  // A show must not leave the window full screen if the app moves on without ending it.
  useEffect(() => () => void setFullscreen(false), []);

  return { presenting, lifted, present, endShow, modeMessage, showing, presentButton };
}
