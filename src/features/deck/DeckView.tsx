import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useApp } from "../../appStore";
import type { RuntimeMessage } from "../../lib/deck/bridge";
import { isHidden, wouldHide } from "../../lib/deck/slideOps";
import { AmbientBackground } from "../../ui";
import { cx } from "../../ui/cx";
import { createDeckStore, noteInk } from "./deckStore";
import { EditHeader } from "./EditHeader";
import { EditToolbar } from "./EditToolbar";
import { TextToolbar } from "./TextToolbar";
import { LayoutGallery } from "./LayoutGallery";
import type { OpenDeck } from "./openDeck";
import { SlideListPanel } from "./SlideListPanel";
import { SlideMenu, type SlideMenuTarget } from "./SlideMenu";
import { useDeckSave } from "./useDeckSave";
import { useFrameChrome } from "./useFrameChrome";
import { useCoverThumb } from "./useCoverThumb";
import { useShow } from "./useShow";
import { useSlideText } from "./useSlideText";
import { useLeaveGuard } from "./useLeaveGuard";
import { useEditKeys, type KeyPress } from "./useEditKeys";
import { useSlideEditing } from "./useSlideEditing";
import { exportToolbar, importToolbar, loadToolbar, saveToolbar } from "./toolbarFile";
import { useDeckInk } from "./useDeckInk";
import { RuntimeFrame, type RuntimeFrameHandle } from "./RuntimeFrame";
import styles from "./DeckView.module.css";

/** Long enough for the slide to be drawn after it appears. */

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
  const [slide, setSlide] = useState(start);
  const [steps, setSteps] = useState(0);
  const [total, setTotal] = useState(deck.slideCount);
  const latestSlide = useRef(start);
  const [store] = useState(() => createDeckStore(deck.slides, deck.recovered));
  const canUndo = useStore(store, (doc) => doc.past.length > 0);
  const canRedo = useStore(store, (doc) => doc.future.length > 0);
  const slides = useStore(store, (doc) => doc.slides);
  const [gallery, setGallery] = useState(false);
  const [shrunk, setShrunk] = useState(false);
  // Each page stays out of sight until it has something to show, or it flashes blank first.
  const [stageReady, setStageReady] = useState(false);
  // The page starts on a slide of its own choosing, so only the one it's sent to counts.
  const firstSlide = useRef<number | null>(null);
  const [listReady, setListReady] = useState(false);
  const [menu, setMenu] = useState<SlideMenuTarget | null>(null);
  const [syncs, setSyncs] = useState(0);
  const sorterBox = useRef<HTMLDivElement>(null);
  const inkDrawn = useCallback(() => noteInk(store), [store]);
  const ink = useDeckInk(deck, sorter, inkDrawn);
  const { send } = ink;
  const afterSync = useCallback(() => {
    send(stage);
    send(sorter);
    setSyncs((n) => n + 1);
  }, [send]);
  const editing = useSlideEditing({
    deck,
    store,
    stage,
    sorter,
    start,
    slideRef: latestSlide,
    afterSync,
  });
  const { selected, setSelected } = editing;
  const text = useSlideText(stage, editing.setText);

  const { dirty, saving, save, discard } = useDeckSave({ deck, store, inkFile: ink.file });
  const guard = useLeaveGuard({ dirty, title: deck.manifest.title, save, discard });

  const { postChrome, postLogo } = useFrameChrome(stage, sorter);
  const { presenting, lifted, present, endShow, modeMessage, showing, presentButton } = useShow(
    stage,
    latestSlide,
    presentOnOpen,
  );

  const cover = useCoverThumb(deck, stage);

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

  /** Everything the page needs before anything is shown: saved settings, the logo, the ink. */
  const startStage = async (from: number) => {
    const toolbar = await loadToolbar();
    if (toolbar) stage.current?.post("toolbar", toolbar);
    postLogo();
    postChrome();
    ink.send(stage);
    if (showing.current) {
      setStageReady(true);
      present(from);
      return;
    }
    // Reopened part-way through, the first slide would never be seen to take its picture.
    const needsCover = from > 0 && cover.stale();
    firstSlide.current = needsCover ? 0 : from;
    if (needsCover) {
      stage.current?.post("mode", modeMessage("edit", 0));
      await cover.takeNow();
    }
    stage.current?.post("mode", modeMessage("edit", from));
  };

  /**
   * A slide page can post anything, but only real typing makes the browser count the user as
   * active, so a page's script can't write to the user's file on its own.
   */
  const onFrameKey = (press: KeyPress) => {
    const save = press.ctrl && press.key.toLowerCase() === "s";
    if (!save || navigator.userActivation.isActive) onKey(press);
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
      if (message.slide === firstSlide.current) setStageReady(true);
      cover.slideShown(message.slide, presenting);
    } else if (message.type === "key") {
      onFrameKey(message);
    } else if (message.type === "end") {
      endShow();
    } else if (text.onMessage(message)) {
      return;
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
      ink.send(sorter);
      setListReady(true);
    } else if (message.type === "key") {
      onFrameKey(message);
    } else if (message.type === "scrolled") {
      setShrunk(message.down);
    } else if (message.type === "pick" || message.type === "menu" || message.type === "move") {
      if (message.slide >= 0 && message.slide < slides.length) onSlidePicked(message);
    }
  };

  const onSlidePicked = (message: RuntimeMessage) => {
    if (message.type === "pick") {
      setMenu(null);
      editing.pick(message.slide, message);
    } else if (message.type === "move") {
      if (message.to >= 0 && message.to <= slides.length) editing.move(message.slide, message.to);
    } else if (message.type === "menu") {
      const box = sorterBox.current?.getBoundingClientRect();
      setSelected((now) => (now.includes(message.slide) ? now : [message.slide]));
      setMenu({
        slide: message.slide,
        x: (box?.left ?? 0) + message.x,
        y: (box?.top ?? 0) + message.y,
      });
    }
  };

  const closeMenu = useCallback(() => {
    setMenu(null);
    sorter.current?.focus();
    sorter.current?.post("focusList");
  }, []);
  const menuAway = useCallback(() => setMenu(null), []);

  const leave = async () => {
    if (await guard()) closeDeck();
  };

  return (
    <div
      className={styles.view}
      data-presenting={presenting || undefined}
      data-lifted={lifted || undefined}
    >
      <AmbientBackground layout="edit" />
      <EditHeader
        title={deck.manifest.title}
        dirty={dirty}
        saving={saving}
        canUndo={canUndo}
        canRedo={canRedo}
        presentRef={presentButton}
        onBack={() => void leave()}
        onUndo={editing.undo}
        onRedo={editing.redo}
        onSave={() => void save()}
        onSaveAs={() => void save(true)}
        onPresent={() => present(slide)}
        onPresentFromStart={() =>
          present(
            Math.max(
              0,
              slides.findIndex((s) => !isHidden(s)),
            ),
          )
        }
      />
      <div className={styles.body}>
        <SlideListPanel
          token={deck.token}
          title={deck.manifest.title}
          boxRef={sorterBox}
          frameRef={sorter}
          onMessage={onSorterMessage}
          ready={listReady}
          onAdd={() => setGallery(true)}
        />
        <main className={styles.main}>
          <div className={styles.stage} data-ready={stageReady || undefined}>
            <RuntimeFrame
              ref={stage}
              token={deck.token}
              title={deck.manifest.title}
              className={cx(lifted && styles.fullFrame)}
              onMessage={onStageMessage}
            />
          </div>
          <EditToolbar
            slide={slide}
            total={slides.length}
            steps={steps}
            shrunk={shrunk}
            hint={text.picked ? "Double-click text to edit · Esc to finish" : undefined}
            canHide={editing.canHide()}
            canRemove={editing.canRemove()}
            onGo={(to) => editing.pick(to, { ctrl: false, shift: false })}
            onDuplicate={() => editing.duplicate(slide)}
            onHide={() => editing.hide(slide)}
            onRemove={() => editing.remove(slide)}
            onOpen={() => setShrunk(false)}
          />
        </main>
      </div>
      <TextToolbar
        bar={presenting ? null : text.bar}
        formula={text.formula}
        frame={stage}
        onFormula={text.onFormula}
        onFormulaDone={text.onFormulaDone}
      />
      <LayoutGallery open={gallery} onClose={() => setGallery(false)} onPick={editing.add} />
      <SlideMenu
        target={menu}
        hides={wouldHide(slides, selected)}
        canPaste={editing.hasCopied()}
        canHide={menu !== null && editing.canHide()}
        canRemove={menu !== null && editing.canRemove()}
        count={selected.length}
        onClose={closeMenu}
        onAway={menuAway}
        on={editing}
      />
    </div>
  );
}
