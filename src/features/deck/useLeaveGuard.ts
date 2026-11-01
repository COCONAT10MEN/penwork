import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef } from "react";
import { useApp } from "../../appStore";
import type { ChoiceOptions } from "./useChoice";

/** Asks about unsaved work before the presentation goes, whichever way it's leaving. */
export function useLeaveGuard(options: {
  dirty: boolean;
  title: string;
  ask: <T extends string>(question: ChoiceOptions<T>) => Promise<T | null>;
  save: () => Promise<boolean>;
  discard: () => void;
}): () => Promise<boolean> {
  const { dirty, title, ask, save, discard } = options;

  /** True when it's fine to move on: nothing unsaved, or the user has decided what to do with it. */
  const guard = useCallback(async () => {
    if (!dirty) return true;
    const answer = await ask({
      headline: "Save your changes?",
      text: `"${title}" has changes that aren't saved.`,
      icon: "save",
      actions: [
        { value: "cancel", label: "Cancel" },
        { value: "discard", label: "Don't save" },
        { value: "save", label: "Save" },
      ],
    });
    if (answer === "discard") discard();
    return answer === "save" ? save() : answer === "discard";
  }, [dirty, ask, title, save, discard]);

  useEffect(() => {
    useApp.setState({ leaveGuard: guard });
    return () => useApp.setState({ leaveGuard: null });
  }, [guard]);

  // Closing the window is one more way to leave. Tauri only asks once, so this stays registered.
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

  return guard;
}
