import { invoke, isTauri } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useApp } from "../../appStore";
import { deckFacts } from "../../lib/deck/facts";
import type { InkBySlide } from "../../lib/deck/ink";
import { joinSlides, type DeckSlide } from "../../lib/deck/slideOps";
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
  /** The ink, as ink.json wants it. Null when there's none. */
  inkFile: (slides: readonly DeckSlide[]) => { version: 1; slides: InkBySlide } | null;
  ask: <T extends string>(question: ChoiceOptions<T>) => Promise<T | null>;
}) {
  const { deck, store, inkFile, ask } = options;
  const notify = useSnackbar();
  const dirty = useStore(store, isDirty);
  const cleanedOk = useRef(false);
  const saving = useRef(false);
  // The copy on disk: which one it is, what's in it, and the write still under way, if any.
  const copyId = useRef(libraryId(deck.path));
  const copyOf = useRef<{ slides: DeckSlide[]; ink: number } | null>(null);
  const writing = useRef<Promise<void> | null>(null);
  const copyFailed = useRef(false);

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

  const write = useCallback(
    async (saveAs: boolean): Promise<boolean> => {
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
        // Read together, right before the save, so "saved" means exactly what went into the file.
        const { slides, inkEdits } = store.getState();
        const ink = inkFile(slides);
        const saved = await invoke<{ path: string; stamp: string; imagesLost: boolean }>(
          "save_deck",
          { token: deck.token, path: newPath, manifest, ink },
        );
        markSaved(store, slides, inkEdits);
        useApp.getState().deckSaved({
          oldPath: deck.path,
          // A draft becomes the real file. Save as on a real file leaves that one as it was.
          rename: deck.draft,
          path: saved.path,
          stamp: saved.stamp,
          slides: slides.length,
          facts: deckFacts(joinSlides(slides)),
          ink: ink !== null,
        });
        if (deck.draft) void invoke("delete_draft", { path: deck.path });
        notify(
          saved.imagesLost
            ? {
                message:
                  "Saved, but images from the original file are missing because it has moved.",
                duration: 10_000,
              }
            : { message: "Saved." },
        );
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

  const save = useCallback(
    async (saveAs = false): Promise<boolean> => {
      if (saving.current) return false;
      saving.current = true;
      try {
        return await write(saveAs);
      } finally {
        saving.current = false;
      }
    },
    [write],
  );

  // Autosave goes to a separate copy, never to the user's file.
  useEffect(() => {
    if (!dirty || !isTauri()) return;
    const timer = setInterval(() => {
      const id = libraryId(deck.path);
      const { slides, inkEdits } = store.getState();
      const same = copyOf.current?.slides === slides && copyOf.current.ink === inkEdits;
      if (!id || saving.current || writing.current || same) return;
      copyId.current = id;
      writing.current = invoke("write_recovery", {
        token: deck.token,
        id,
        ink: inkFile(slides),
      })
        .then(
          () => {
            copyOf.current = { slides, ink: inkEdits };
            copyFailed.current = false;
          },
          () => {
            if (copyFailed.current) return;
            copyFailed.current = true;
            notify({
              message: "Penwork can't keep a recovery copy right now. Save soon.",
              duration: 10_000,
            });
          },
        )
        .finally(() => {
          writing.current = null;
        });
    }, RECOVERY_EVERY);
    return () => clearInterval(timer);
  }, [dirty, deck.path, deck.token, store, inkFile, notify]);

  const discard = useCallback(async () => {
    await writing.current;
    copyOf.current = null;
    if (copyId.current && isTauri()) {
      await invoke("delete_recovery", { id: copyId.current }).catch(() => {});
    }
  }, []);

  // Saved, or undone back to what's in the file: the copy has nothing left to offer.
  const wasDirty = useRef(dirty);
  useEffect(() => {
    if (wasDirty.current && !dirty) void discard();
    wasDirty.current = dirty;
  }, [dirty, discard]);

  return { dirty, save, discard };
}
