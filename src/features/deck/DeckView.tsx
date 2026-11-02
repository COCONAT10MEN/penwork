import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useApp } from "../../appStore";
import type { SlideProblem } from "../../lib/deck/bridge";
import { firstShown, wouldHide } from "../../lib/deck/slideOps";
import { AmbientBackground } from "../../ui";
import { cx } from "../../ui/cx";
import { createDeckStore, noteInk } from "./deckStore";
import { EditHeader } from "./EditHeader";
import { EditToolbar } from "./EditToolbar";
import { AskAi } from "./inspector/AskAi";
import { PresentationSettings } from "./PresentationSettings";
import { UnderSlide } from "./ReplyBar";
import { useAskAi } from "./useAskAi";
import { Inspector, type EditMode } from "./inspector/Inspector";
import { TextToolbar } from "./TextToolbar";
import { LayoutGallery } from "./LayoutGallery";
import type { OpenDeck } from "./openDeck";
import { SlideListPanel } from "./SlideListPanel";
import { SlideMenu, type SlideMenuTarget } from "./SlideMenu";
import { useDeckSave } from "./useDeckSave";
import { useFrameChrome } from "./useFrameChrome";
import { useCoverThumb } from "./useCoverThumb";
import { useShow } from "./useShow";
import { useStageEvents } from "./useStageEvents";
import { useSlideListEvents } from "./useSlideListEvents";
import { useSlideText } from "./useSlideText";
import { useLeaveGuard } from "./useLeaveGuard";
import { useEditKeys } from "./useEditKeys";
import { useSlideEditing } from "./useSlideEditing";
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
  const stage = useRef<RuntimeFrameHandle>(null);
  const sorter = useRef<RuntimeFrameHandle>(null);
  const [slide, setSlide] = useState(start);
  const [steps, setSteps] = useState(0);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<EditMode>("edit");
  const [total, setTotal] = useState(deck.slideCount);
  const latestSlide = useRef(start);
  const [store] = useState(() =>
    createDeckStore(
      deck.slides,
      { manifest: deck.manifest.raw, theme: deck.themeCss },
      deck.recovered,
    ),
  );
  const meta = useStore(store, (doc) => doc.meta);
  const title = typeof meta.manifest.title === "string" ? meta.manifest.title : deck.manifest.title;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [problems, setProblems] = useState<SlideProblem[]>([]);
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
  const slot = useRef<HTMLDivElement>(null);
  const show = useShow(stage, slot, latestSlide, presentOnOpen);
  const { presenting, lifted, present, endShow, presentButton } = show;

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

  const { onStageMessage, onFrameKey } = useStageEvents({
    stage,
    start,
    show,
    ink,
    cover,
    text,
    editing,
    firstSlide,
    latestSlide,
    onKey,
    postLogo,
    postChrome,
    onReady: () => setStageReady(true),
    onTotal: setTotal,
    onState: (state) => {
      setSlide(state.slide);
      setSteps(state.steps);
      setStep(state.step);
    },
  });

  const ai = useAskAi({ stage, slides, slide, meta, title });

  const onSorterMessage = useSlideListEvents({
    box: sorterBox,
    slideCount: slides.length,
    editing,
    setSelected,
    setMenu,
    onKey: onFrameKey,
    onScrolled: setShrunk,
    onChecked: setProblems,
    onReady: () => {
      postChrome();
      sorter.current?.post("select", { slide, selected });
      ink.send(sorter);
      setListReady(true);
    },
  });

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
        title={title}
        onSettings={() => setSettingsOpen(true)}
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
        mode={mode}
        onMode={(next) => {
          setMode(next);
          stage.current?.post("stepView", { on: next === "steps", step: 0 });
        }}
        onPresent={() => present(slide)}
        onPresentFromStart={() => present(firstShown(slides))}
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
          <div ref={slot} className={styles.stage} />
          <UnderSlide ai={ai} slide={slide} editing={editing}>
            <EditToolbar
              slide={slide}
              total={slides.length}
              steps={steps}
              shrunk={shrunk}
              hint={text.picked ? "Double-click text to edit" : undefined}
              canHide={editing.canHide()}
              canRemove={editing.canRemove()}
              onGo={(to) => editing.pick(to, { ctrl: false, shift: false })}
              onDuplicate={() => editing.duplicate(slide)}
              onHide={() => editing.hide(slide)}
              onRemove={() => editing.remove(slide)}
              onOpen={() => setShrunk(false)}
            />
          </UnderSlide>
        </main>
        <Inspector
          mode={mode}
          slide={slide}
          slideData={slides[slide]}
          picked={text.picked}
          step={step}
          steps={steps}
          canHide={editing.canHide()}
          token={deck.token}
          onChange={(n, tag, how) => editing.change(slide, n, tag, how)}
          onPreview={(n, message) => stage.current?.post("preview", { n, ...message })}
          onPick={(n) => stage.current?.post("pick", { n })}
          onHide={() => editing.hide(slide)}
          onStep={(to) => stage.current?.post("stepView", { on: true, step: to })}
          onNotes={(notes) => editing.setNotes(slide, notes)}
          problems={problems.filter((p) => p.slide === slide).map((p) => p.text)}
          ask={
            <AskAi
              onCopy={(scope, request) => void ai.copy(scope, request)}
              onPaste={() => void ai.paste()}
            />
          }
        />
      </div>
      <RuntimeFrame
        ref={stage}
        token={deck.token}
        title={deck.manifest.title}
        className={cx(
          styles.stageFrame,
          lifted && styles.fullFrame,
          stageReady && styles.frameReady,
        )}
        onMessage={onStageMessage}
      />
      <TextToolbar
        bar={presenting ? null : text.bar}
        formula={text.formula}
        frame={stage}
        onFormula={text.onFormula}
        onFormulaDone={text.onFormulaDone}
      />
      <PresentationSettings
        open={settingsOpen}
        meta={meta}
        slides={slides}
        onClose={() => setSettingsOpen(false)}
        onApply={editing.setMeta}
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
