import { invoke, isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useApp } from "../../appStore";
import { hasInk, readInk, readStrokes, writeInk, type InkBySlide } from "../../lib/deck/ink";
import type { OpenDeck } from "./openDeck";
import type { RuntimeFrameHandle } from "./RuntimeFrame";

const SAVE_DELAY = 500;
type Frame = RefObject<RuntimeFrameHandle | null>;

function libraryId(deck: OpenDeck): string | undefined {
  const key = deck.path.toLowerCase();
  return useApp.getState().library.decks.find((d) => d.path.toLowerCase() === key)?.id;
}

async function loadInk(deck: OpenDeck): Promise<InkBySlide> {
  const fromFile = readInk(deck.ink);
  const id = libraryId(deck);
  if (!isTauri() || !id) return fromFile;
  const text = await invoke<string | null>("read_ink", { id }).catch(() => null);
  if (!text) return fromFile;
  try {
    return { ...fromFile, ...readInk(JSON.parse(text)) };
  } catch {
    return fromFile;
  }
}

/**
 * A presentation's ink. Until Save arrives in M4 it can't go into the file, so it's kept in the
 * app's own folder, on top of whatever ink the file already has.
 */
export function useDeckInk(deck: OpenDeck, sorter: Frame) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dirty = useRef(false);
  const [loaded] = useState(() => loadInk(deck));

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const id = libraryId(deck);
    if (!dirty.current || !id || !isTauri()) return;
    dirty.current = false;
    const ink = await loaded;
    void invoke("write_ink", { id, text: writeInk(ink) });
    useApp.getState().inkSaved(id, hasInk(ink));
  }, [deck, loaded]);

  useEffect(
    () => () => {
      void flush();
    },
    [flush],
  );

  const send = useCallback(
    async (frame: Frame) => {
      frame.current?.post("ink", { slides: await loaded });
    },
    [loaded],
  );

  const changed = useCallback(
    (slide: string, strokes: unknown) => {
      const clean = readStrokes(strokes);
      void loaded.then((ink) => {
        // An empty list is kept: it says this slide's ink was erased, over any ink in the file.
        ink[slide] = clean;
        dirty.current = true;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(), SAVE_DELAY);
        sorter.current?.post("ink", { slides: { [slide]: clean } });
      });
    },
    [loaded, flush, sorter],
  );

  return { send, changed };
}
