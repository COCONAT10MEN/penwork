import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useApp } from "../../appStore";
import type { RuntimeMessage } from "../../lib/deck/bridge";
import { isHidden } from "../../lib/deck/slideOps";
import { AmbientBackground, Button, penworkLogoSvg, Surface } from "../../ui";
import { cx } from "../../ui/cx";
import { logoColor } from "../settings/appearance";
import { useSettings } from "../settings/settingsStore";
import { createDeckStore } from "./deckStore";
import { EditHeader } from "./EditHeader";
import { LayoutGallery } from "./LayoutGallery";
import type { OpenDeck } from "./openDeck";
import { SlideMenu, type SlideMenuTarget } from "./SlideMenu";
import { useChoice } from "./useChoice";
import { useDeckSave } from "./useDeckSave";
import { useEditKeys } from "./useEditKeys";
import { useSlideEditing } from "./useSlideEditing";
import { exportToolbar, importToolbar, loadToolbar, saveToolbar } from "./toolbarFile";
import { useDeckInk } from "./useDeckInk";
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
  const notifyCleaned = useRef(false);
  const rememberSlide = useApp((s) => s.rememberSlide);
  const stage = useRef<RuntimeFrameHandle>(null);
  const sorter = useRef<RuntimeFrameHandle>(null);
  const captureTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [slide, setSlide] = useState(start);
  const [steps, setSteps] = useState(0);
  const [total, setTotal] = useState(deck.slideCount);
  const [presenting, setPresenting] = useState(presentOnOpen);
  // For code that runs outside a render: a show can start while the page is still being set up.
  const showing = useRef(presentOnOpen);
  const latestSlide = useRef(start);
  const [store] = useState(() => createDeckStore(deck.slides, deck.recovered));
  const canUndo = useStore(store, (doc) => doc.past.length > 0);
  const canRedo = useStore(store, (doc) => doc.future.length > 0);
  const slides = useStore(store, (doc) => doc.slides);
  const [gallery, setGallery] = useState(false);
  const [menu, setMenu] = useState<SlideMenuTarget | null>(null);
  const [syncs, setSyncs] = useState(0);
  const sorterBox = useRef<HTMLDivElement>(null);
  const { dialog, ask } = useChoice();
  const inkChanged = useCallback(() => store.setState({ inkChanged: true }), [store]);
  const ink = useDeckInk(deck, sorter, inkChanged);
  const afterSync = useCallback(() => {
    void ink.send(stage);
    void ink.send(sorter);
    setSyncs((n) => n + 1);
  }, [ink]);
  const editing = useSlideEditing({ deck, store, stage, sorter, slideRef: latestSlide, afterSync });
  const { selected, setSelected } = editing;

  // Once per presentation: after this Save, what was removed is gone from the file too.
  const confirmCleaned = useCallback(async () => {
    if (notifyCleaned.current) return true;
    const answer = await ask({
      headline: "Save the cleaned-up version?",
      text: `Penwork removed this when opening the file: ${deck.removed.join(", ")}. Saving makes that permanent.`,
      icon: "cleaning_services",
      actions: [
        { value: "cancel", label: "Cancel" },
        { value: "save", label: "Save" },
      ],
    });
    notifyCleaned.current = answer === "save";
    return notifyCleaned.current;
  }, [ask, deck.removed]);
  const { dirty, save, discard } = useDeckSave({ deck, store, inkFile: ink.file, confirmCleaned });

  /** True when it's fine to move on: nothing unsaved, or the user has decided what to do with it. */
  const guard = useCallback(async () => {
    if (!dirty) return true;
    const answer = await ask({
      headline: "Save your changes?",
      text: `"${deck.manifest.title}" has changes that aren't saved.`,
      icon: "save",
      actions: [
        { value: "cancel", label: "Cancel" },
        { value: "discard", label: "Don't save" },
        { value: "save", label: "Save" },
      ],
    });
    if (answer === "discard") discard();
    return answer === "save" ? save() : answer === "discard";
  }, [dirty, ask, deck.manifest.title, save, discard]);

  useEffect(() => {
    useApp.setState({ leaveGuard: guard });
    return () => useApp.setState({ leaveGuard: null });
  }, [guard]);

  // Closing the window is one more way to leave.
  const guardRef = useRef(guard);
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    guardRef.current = guard;
    dirtyRef.current = dirty;
  });
  useEffect(() => {
    if (!isTauri()) return;
    const stop = getCurrentWindow().onCloseRequested(async (event) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      if (await guardRef.current()) void getCurrentWindow().destroy();
    });
    return () => void stop.then((unlisten) => unlisten());
  }, []);
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

  const postLogo = useCallback(() => {
    const { settings, systemSeed: seed } = useSettings.getState();
    stage.current?.post("logo", {
      svg: settings.logo?.svg ?? penworkLogoSvg(),
      color: logoColor(settings, seed),
      background: settings.logoBackground,
    });
  }, []);

  // The default theme follows Windows, which can change while a presentation is open.
  useEffect(() => {
    postChrome();
    postLogo();
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    dark.addEventListener("change", postChrome);
    return () => dark.removeEventListener("change", postChrome);
  }, [postChrome, postLogo, systemSeed]);

  const modeMessage = (mode: "edit" | "present", from: number) => {
    const { reduceMotion, endOfShow } = useSettings.getState().settings;
    return { mode, slide: from, reduced: reduceMotion, loop: endOfShow === "loop" };
  };

  const present = useCallback((from: number) => {
    showing.current = true;
    setPresenting(true);
    // The show starts once the window is full size, so its opening isn't seen at the old size.
    void setFullscreen(true).then(() => {
      stage.current?.post("mode", modeMessage("present", from));
      stage.current?.focus();
    });
  }, []);

  const endShow = useCallback(() => {
    showing.current = false;
    stage.current?.post("mode", modeMessage("edit", latestSlide.current));
    setPresenting(false);
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

  const onKey = useEditKeys({
    presenting,
    stage,
    slide,
    total,
    present,
    endShow,
    showSlide,
    editing,
    save,
  });

  // The selection is drawn in the slide list's own page, so it's sent over each time it changes.
  useEffect(() => {
    sorter.current?.post("select", { slide, selected });
  }, [slide, selected, syncs]);

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

  /** Everything the page needs before anything is shown: saved settings, the logo, the ink. */
  const startStage = async (from: number) => {
    const toolbar = await loadToolbar();
    if (toolbar) stage.current?.post("toolbar", toolbar);
    postLogo();
    await ink.send(stage);
    if (showing.current) present(from);
    else stage.current?.post("mode", modeMessage("edit", from));
  };

  const onStageMessage = (message: RuntimeMessage) => {
    if (message.type === "ready") {
      setTotal(message.total);
      void startStage(Math.min(start, Math.max(0, message.total - 1)));
    } else if (message.type === "state") {
      latestSlide.current = message.slide;
      setSlide(message.slide);
      setSteps(message.steps);
      setTotal(message.total);
      rememberSlide(message.slide);
      setSelected((now) => (now.includes(message.slide) ? now : [message.slide]));
      thumbOnFirstSlide(message.slide);
    } else if (message.type === "key") {
      onKey(message);
    } else if (message.type === "end") {
      endShow();
    } else if (message.type === "toolbar") {
      saveToolbar(message.settings);
    } else if (message.type === "exportToolbar") {
      void exportToolbar(message.text);
    } else if (message.type === "importToolbar") {
      void importToolbar((text) => stage.current?.post("toolbarFile", { text }));
    } else if (message.type === "ink") {
      ink.changed(message.id, message.strokes);
    }
  };

  const onSorterMessage = (message: RuntimeMessage) => {
    if (message.type === "ready") {
      postChrome();
      sorter.current?.post("select", { slide, selected });
      void ink.send(sorter);
    } else if (message.type === "pick") {
      editing.pick(message.slide, message);
    } else if (message.type === "move") {
      editing.move(message.slide, message.to);
    } else if (message.type === "menu") {
      const box = sorterBox.current?.getBoundingClientRect();
      setSelected((now) => (now.includes(message.slide) ? now : [message.slide]));
      setMenu({
        slide: message.slide,
        x: (box?.left ?? 0) + message.x,
        y: (box?.top ?? 0) + message.y,
      });
    } else if (message.type === "key") {
      onKey(message);
    }
  };

  const leave = async () => {
    if (await guard()) closeDeck();
  };
  const menuSlide = slides[menu?.slide ?? -1];

  return (
    <div className={styles.view} data-presenting={presenting || undefined}>
      <AmbientBackground />
      <EditHeader
        title={deck.manifest.title}
        total={total}
        dirty={dirty}
        canUndo={canUndo}
        canRedo={canRedo}
        presentRef={presentButton}
        onBack={() => void leave()}
        onUndo={editing.undo}
        onRedo={editing.redo}
        onSave={() => void save()}
        onSaveAs={() => void save(true)}
        onPresent={() => present(slide)}
      />
      <div className={styles.body}>
        <Surface
          material="glass"
          className={styles.sorter}
          role="complementary"
          aria-label="Slides"
        >
          <div ref={sorterBox} className={styles.sorterList}>
            <RuntimeFrame
              ref={sorter}
              token={deck.token}
              title={deck.manifest.title}
              view="sorter"
              className={styles.sorterFrame}
              onMessage={onSorterMessage}
            />
          </div>
          <Button
            size="medium"
            variant="tonal"
            icon="add"
            className={styles.addSlide}
            onClick={() => setGallery(true)}
          >
            Add slide
          </Button>
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
      <LayoutGallery open={gallery} onClose={() => setGallery(false)} onPick={editing.add} />
      <SlideMenu
        target={menu}
        hidden={menuSlide ? isHidden(menuSlide) : false}
        canPaste={editing.hasCopied()}
        count={selected.length}
        onClose={() => setMenu(null)}
        on={editing}
      />
      {dialog}
    </div>
  );
}
