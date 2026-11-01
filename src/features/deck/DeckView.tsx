import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../../appStore";
import type { RuntimeMessage } from "../../lib/deck/bridge";
import { AmbientBackground, Button, IconButton, Surface } from "../../ui";
import { cx } from "../../ui/cx";
import { useSettings } from "../settings/settingsStore";
import { slidesLabel } from "../library/greeting";
import type { OpenDeck } from "./openDeck";
import { PresentDock } from "./PresentDock";
import { RuntimeFrame, type RuntimeFrameHandle } from "./RuntimeFrame";
import { captureThumb } from "./thumbnail";
import styles from "./DeckView.module.css";

/** Long enough for the slide to be drawn after it appears. */
const CAPTURE_DELAY = 500;

function setFullscreen(on: boolean): Promise<void> {
  return isTauri() ? getCurrentWindow().setFullscreen(on) : Promise.resolve();
}

/**
 * A presentation on screen: the edit view, or the full-screen show. Both are the same slide page,
 * so starting a show reloads nothing and ending one lands on the slide it stopped at.
 */
export function DeckView({
  deck,
  start,
  presentOnOpen,
}: {
  deck: OpenDeck;
  start: number;
  presentOnOpen: boolean;
}) {
  const closeDeck = useApp((s) => s.closeDeck);
  const rememberSlide = useApp((s) => s.rememberSlide);
  const stage = useRef<RuntimeFrameHandle>(null);
  const sorter = useRef<RuntimeFrameHandle>(null);
  const captureTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [slide, setSlide] = useState(start);
  const [steps, setSteps] = useState(0);
  const [total, setTotal] = useState(deck.slideCount);
  const [presenting, setPresenting] = useState(presentOnOpen);
  const [gridOpen, setGridOpen] = useState(false);
  const systemSeed = useSettings((s) => s.systemSeed);
  const presentButton = useRef<HTMLButtonElement>(null);
  const wasPresenting = useRef(presenting);

  // The button that ended the show is gone, so focus needs somewhere sensible to land.
  useEffect(() => {
    if (wasPresenting.current && !presenting) presentButton.current?.focus();
    wasPresenting.current = presenting;
  }, [presenting]);

  const postChrome = useCallback(() => {
    const css = getComputedStyle(document.documentElement);
    sorter.current?.post("chrome", {
      accent: css.getPropertyValue("--md-sys-color-primary").trim(),
      text: css.getPropertyValue("--md-sys-color-on-surface").trim(),
      line: css.getPropertyValue("--md-sys-color-outline-variant").trim(),
      scheme: css.colorScheme,
    });
  }, []);

  // The default theme follows Windows, which can change while a presentation is open.
  useEffect(() => {
    postChrome();
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    dark.addEventListener("change", postChrome);
    return () => dark.removeEventListener("change", postChrome);
  }, [postChrome, systemSeed]);

  const modeMessage = (mode: "edit" | "present", from: number) => {
    const { reduceMotion, endOfShow } = useSettings.getState().settings;
    return { mode, slide: from, reduced: reduceMotion, loop: endOfShow === "loop" };
  };

  const present = useCallback((from: number) => {
    setPresenting(true);
    // The show starts once the window is full size, so its opening isn't seen at the old size.
    void setFullscreen(true).then(() => {
      stage.current?.post("mode", modeMessage("present", from));
      stage.current?.focus();
    });
  }, []);

  const endShow = useCallback(() => {
    setSlide((current) => {
      stage.current?.post("mode", modeMessage("edit", current));
      return current;
    });
    setPresenting(false);
    setGridOpen(false);
    void setFullscreen(false);
  }, []);

  // A show must not leave the window full screen if the app moves on without ending it.
  useEffect(() => {
    if (presentOnOpen) void setFullscreen(true);
    return () => {
      clearTimeout(captureTimer.current);
      void setFullscreen(false);
    };
  }, [presentOnOpen]);

  const showSlide = useCallback(
    (next: number) => {
      if (next >= 0 && next < total) stage.current?.post("go", { slide: next });
    },
    [total],
  );

  const onKey = useCallback(
    (key: string, shift: boolean) => {
      if (key === "F5") {
        present(shift ? slide : 0);
      } else if (presenting) {
        if (key === "Escape" || key === "f" || key === "F") endShow();
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
    [present, presenting, endShow, showSlide, slide, total],
  );

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      // F5 would otherwise reload the whole app.
      if (e.key === "F5") e.preventDefault();
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key !== "F5" && e.target instanceof HTMLElement && e.target.closest("button")) {
        if (e.key === " " || e.key === "Enter") return;
      }
      // During a show the slide page owns the keys, even when focus is on a dock button.
      if (presenting) stage.current?.post("key", { key: e.key, shift: e.shiftKey });
      else onKey(e.key, e.shiftKey);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onKey, presenting]);

  // Waits until the first slide has stayed on screen, so moving on quickly can't catch another.
  const thumbOnFirstSlide = (shown: number) => {
    clearTimeout(captureTimer.current);
    const { library, thumbSaved } = useApp.getState();
    const key = deck.path.toLowerCase();
    const entry = library.decks.find((d) => d.path.toLowerCase() === key);
    if (shown !== 0 || presenting || !entry || entry.thumb === deck.stamp) return;
    captureTimer.current = setTimeout(() => {
      const rect = stage.current?.rect();
      if (!rect) return;
      void captureThumb(rect, entry.id).then((saved) => {
        if (saved) thumbSaved(entry.id, deck.stamp);
      });
    }, CAPTURE_DELAY);
  };

  const onStageMessage = (message: RuntimeMessage) => {
    if (message.type === "ready") {
      setTotal(message.total);
      const from = Math.min(start, Math.max(0, message.total - 1));
      if (presentOnOpen) present(from);
      else stage.current?.post("mode", modeMessage("edit", from));
    } else if (message.type === "state") {
      setSlide(message.slide);
      setSteps(message.steps);
      setTotal(message.total);
      rememberSlide(message.slide);
      sorter.current?.post("select", { slide: message.slide });
      thumbOnFirstSlide(message.slide);
    } else if (message.type === "key" && !message.ctrl && !message.alt) {
      onKey(message.key, message.shift);
    } else if (message.type === "grid") {
      setGridOpen(message.open);
    }
  };

  const onSorterMessage = (message: RuntimeMessage) => {
    if (message.type === "ready") {
      postChrome();
      sorter.current?.post("select", { slide });
    } else if (message.type === "pick") {
      showSlide(message.slide);
    } else if (message.type === "key" && !message.ctrl && !message.alt) {
      onKey(message.key, message.shift);
    }
  };

  return (
    <div className={styles.view} data-presenting={presenting || undefined}>
      <AmbientBackground />
      <Surface material="glass" floating className={styles.header}>
        <IconButton icon="arrow_back" label="Back to Home" onClick={closeDeck} />
        <div className={styles.titles}>
          <h1 className={styles.title}>{deck.manifest.title}</h1>
          <p className={styles.meta}>{slidesLabel(total)}</p>
        </div>
        <Button
          ref={presentButton}
          size="medium"
          icon="play_arrow"
          aria-label="Present from this slide"
          onClick={() => present(slide)}
        >
          Present
        </Button>
      </Surface>
      <div className={styles.body}>
        <Surface
          material="glass"
          className={styles.sorter}
          role="complementary"
          aria-label="Slides"
        >
          <RuntimeFrame
            ref={sorter}
            token={deck.token}
            title={deck.manifest.title}
            view="sorter"
            className={styles.sorterFrame}
            onMessage={onSorterMessage}
          />
        </Surface>
        <main className={styles.main}>
          <div className={styles.stage}>
            <RuntimeFrame
              ref={stage}
              token={deck.token}
              title={deck.manifest.title}
              className={cx(presenting && styles.fullFrame)}
              onMessage={onStageMessage}
            />
          </div>
          <Surface material="glass" className={styles.status} role="status">
            <span>
              <b>Slide {slide + 1}</b> of {total}
            </span>
            {steps > 0 && <span>{steps === 1 ? "1 step" : `${steps} steps`}</span>}
          </Surface>
        </main>
      </div>
      {presenting && (
        <PresentDock hidden={gridOpen} onGrid={() => stage.current?.post("grid")} onEnd={endShow} />
      )}
    </div>
  );
}
