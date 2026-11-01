import { invoke, isTauri } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useApp } from "../../appStore";
import { deckFacts } from "../../lib/deck/facts";
import type { InkBySlide } from "../../lib/deck/ink";
import { joinSlides } from "../../lib/deck/slideOps";
import { useSnackbar } from "../../ui";
import { isDirty, markSaved, type DeckStore } from "./deckStore";
import type { OpenDeck } from "./openDeck";
import type { ChoiceOptions } from "./useChoice";

/** Often enough to lose very little (docs/DECK-FORMAT.md §8). */
const RECOVERY_EVERY = 5000;

function libraryId(path: string): string | undefined {
  const key = path.toLowerCase();
  return useApp.getState().library.decks.find((d) => d.path.toLowerCase() === key)?.id;
}

function asDeckPath(path: string): string {
  return path.toLowerCase().endsWith(".pwpptx") ? path : `${path}.pwpptx`;
}

export function useDeckSave(options: {
  deck: OpenDeck;
  store: DeckStore;
  /** The slides, as ink.json wants them. Null when there's no ink at all. */
  inkFile: () => Promise<{ version: 1; slides: InkBySlide } | null>;
  ask: <T extends string>(question: ChoiceOptions<T>) => Promise<T | null>;
}) {
  const { deck, store, inkFile, ask } = options;
  const notify = useSnackbar();
  const dirty = useStore(store, isDirty);
  const cleanedOk = useRef(false);

  // Once per presentation: after this Save, what the sanitiser removed is gone from the file too.
  const confirmCleaned = useCallback(async () => {
    if (deck.removed.length === 0 || cleanedOk.current) return true;
    const answer = await ask({
      headline: "Save the cleaned-up version?",
      text: `Penwork removed this when opening the file: ${deck.removed.join(", ")}. Saving makes that permanent.`,
      icon: "cleaning_services",
      actions: [
        { value: "cancel", label: "Cancel" },
        { value: "save", label: "Save" },
      ],
    });
    cleanedOk.current = answer === "save";
    return cleanedOk.current;
  }, [ask, deck.removed]);

  const save = useCallback(
    async (saveAs = false): Promise<boolean> => {
      if (!(await confirmCleaned())) return false;
      const needsPlace = saveAs || deck.draft;
      const chosen = needsPlace
        ? await saveDialog({
            defaultPath: `${deck.manifest.title}.pwpptx`,
            filters: [{ name: "Penwork presentations", extensions: ["pwpptx"] }],
          })
        : null;
      if (needsPlace && !chosen) return false;
      const newPath = chosen ? asDeckPath(chosen) : null;

      try {
        const manifest = { ...deck.manifest.raw, modified: new Date().toISOString() };
        const { path, stamp } = await invoke<{ path: string; stamp: string }>("save_deck", {
          token: deck.token,
          path: newPath,
          manifest,
          ink: await inkFile(),
        });
        const oldId = libraryId(deck.path);
        const html = joinSlides(store.getState().slides);
        markSaved(store);
        useApp.getState().deckSaved({
          oldPath: deck.path,
          // A draft becomes the real file. Save as on a real file leaves that one as it was.
          rename: deck.draft,
          path,
          stamp,
          slides: store.getState().slides.length,
          facts: deckFacts(html),
          ink: (await inkFile()) !== null,
        });
        if (oldId) {
          void invoke("delete_recovery", { id: oldId });
          if (!newPath || deck.draft) void invoke("delete_ink", { id: oldId });
        }
        if (deck.draft) void invoke("delete_draft", { path: deck.path });
        notify({ message: "Saved." });
        return true;
      } catch (error) {
        const detail = typeof error === "object" && error && "message" in error;
        notify({
          message: detail ? String(error.message) : "This presentation couldn't be saved.",
          duration: 10_000,
        });
        return false;
      }
    },
    [deck, store, inkFile, confirmCleaned, notify],
  );

  // Autosave goes to a separate copy, never to the user's file.
  useEffect(() => {
    if (!dirty || !isTauri()) return;
    const timer = setInterval(() => {
      const id = libraryId(deck.path);
      if (!id) return;
      void inkFile().then((ink) =>
        invoke("write_recovery", { token: deck.token, id, ink }).catch(() => {}),
      );
    }, RECOVERY_EVERY);
    return () => clearInterval(timer);
  }, [dirty, deck.path, deck.token, inkFile]);

  const discard = useCallback(() => {
    const id = libraryId(deck.path);
    if (id && isTauri()) void invoke("delete_recovery", { id });
  }, [deck.path]);

  return { dirty, save, discard };
}
