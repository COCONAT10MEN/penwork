import { useEffect, useMemo, useRef } from "react";
import { showError } from "../notices/notices";

/** One of the app's own changes to the PDF, and how to take it back and do it again. */
export interface Step {
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
}

/**
 * The PDF has one undo history, kept by the page's toolbar (engine.js) so its Undo and Redo, and
 * Ctrl+Z and Ctrl+Y, go through ink and the app's changes alike, in the order they were made. The
 * app's changes go in by id; the toolbar asks for them back, and waits until each is done.
 */
export function useEditHistory(frame: HTMLIFrameElement | null) {
  const steps = useRef(new Map<string, Step>());
  const next = useRef(1);

  useEffect(() => {
    if (!frame) return;
    const post = (type: string, payload: Record<string, unknown> = {}) =>
      frame.contentWindow?.postMessage({ v: 1, type, payload }, location.origin);
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || e.data?.v !== 1) return;
      const { type, payload } = e.data as { type: string; payload?: { id?: unknown } };
      const id = String(payload?.id ?? "");
      // Redo was given up for something new: what it held can go.
      if (type === "histDrop") steps.current.delete(id);
      if (type !== "histUndo" && type !== "histRedo") return;
      const step = steps.current.get(id);
      void Promise.resolve()
        .then(() => (type === "histUndo" ? step?.undo() : step?.redo()))
        .catch((err: unknown) => showError(err instanceof Error ? err.message : String(err)))
        .finally(() => post("histDone"));
    };
    // Ctrl+Z and Ctrl+Y pressed in the app's bar or sheet work as they do on the page, except in a
    // field, where they're the field's own.
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("input, textarea, select, [contenteditable=true], [role=textbox]")) return;
      e.preventDefault();
      post(key === "y" || e.shiftKey ? "redo" : "undo");
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKey);
    };
  }, [frame]);

  return useMemo(() => {
    const post = (type: string, payload: Record<string, unknown> = {}) =>
      frame?.contentWindow?.postMessage({ v: 1, type, payload }, location.origin);
    return {
      /** Puts a change done just now into the history; gives back its id. */
      add(step: Step): string {
        const id = String(next.current++);
        steps.current.set(id, step);
        post("histAdd", { id });
        return id;
      },
      /** Undo the last change; with an id, only while that change is still the last one. */
      undo: (id?: string) => post("undo", id ? { id } : {}),
      redo: () => post("redo"),
    };
  }, [frame]);
}
