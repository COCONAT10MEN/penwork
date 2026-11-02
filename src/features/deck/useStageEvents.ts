import type { RefObject } from "react";
import { useApp } from "../../appStore";
import type { RuntimeMessage } from "../../lib/deck/bridge";
import type { RuntimeFrameHandle } from "./RuntimeFrame";
import { exportToolbar, importToolbar, loadToolbar, saveToolbar } from "./toolbarFile";
import type { useCoverThumb } from "./useCoverThumb";
import type { useDeckInk } from "./useDeckInk";
import type { KeyPress } from "./useEditKeys";
import type { useShow } from "./useShow";
import type { useSlideEditing } from "./useSlideEditing";
import type { useSlideText } from "./useSlideText";

/** What the slide page says, and everything it needs before it shows anything. */
export function useStageEvents({
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
  onReady,
  onTotal,
  onState,
}: {
  stage: RefObject<RuntimeFrameHandle | null>;
  start: number;
  show: ReturnType<typeof useShow>;
  ink: ReturnType<typeof useDeckInk>;
  cover: ReturnType<typeof useCoverThumb>;
  text: ReturnType<typeof useSlideText>;
  editing: ReturnType<typeof useSlideEditing>;
  firstSlide: RefObject<number | null>;
  latestSlide: RefObject<number>;
  onKey: (press: KeyPress) => void;
  postLogo: () => void;
  postChrome: () => void;
  onReady: () => void;
  onTotal: (total: number) => void;
  onState: (state: { slide: number; step: number; steps: number }) => void;
}) {
  const { showing, present, modeMessage, endShow, presenting } = show;

  /** Everything the page needs before anything is shown: saved settings, the logo, the ink. */
  const startStage = async (from: number) => {
    const toolbar = await loadToolbar();
    if (toolbar) stage.current?.post("toolbar", toolbar);
    postLogo();
    postChrome();
    ink.send(stage);
    if (showing.current) {
      onReady();
      useApp.getState().endLaunch();
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
      onTotal(message.total);
      void startStage(Math.min(start, Math.max(0, message.total - 1)));
    } else if (message.type === "state") {
      latestSlide.current = message.slide;
      onState(message);
      onTotal(message.total);
      useApp.getState().rememberSlide(message.slide);
      editing.setSelected((now) => (now.includes(message.slide) ? now : [message.slide]));
      if (message.slide === firstSlide.current) onReady();
      cover.slideShown(message.slide, presenting);
    } else if (message.type === "key") {
      onFrameKey(message);
    } else if (message.type === "end") {
      endShow();
    } else if (message.type === "removePicked") {
      editing.change(message.slide, message.n, message.tag, (el) => el.remove(), false);
    } else if (text.onMessage(message)) {
      return;
    } else if (message.type === "toolbar") {
      saveToolbar(message.settings);
    } else if (message.type === "exportToolbar") {
      void exportToolbar(message.text);
    } else if (message.type === "importToolbar") {
      void importToolbar((file) => stage.current?.post("toolbarFile", { text: file }));
    } else if (message.type === "ink") {
      ink.changed(message.id, message.strokes);
    }
  };

  return { onStageMessage, onFrameKey };
}
