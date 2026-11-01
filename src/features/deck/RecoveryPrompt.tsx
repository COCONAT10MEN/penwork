import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { useApp } from "../../appStore";
import { useSnackbar } from "../../ui";
import { useChoice } from "./useChoice";

/** After a crash, unsaved work is waiting in a recovery copy. The user's file wasn't touched. */
export function RecoveryPrompt() {
  const notify = useSnackbar();
  const ready = useApp((s) => s.libraryReady);
  const { dialog, ask } = useChoice();

  useEffect(() => {
    if (!ready || !isTauri()) return;
    void (async () => {
      const ids = await invoke<string[]>("list_recovery").catch(() => []);
      for (const id of ids) {
        const entry = useApp.getState().library.decks.find((d) => d.id === id);
        // Nothing to name it by, but it's still someone's work, so the copy stays where it is.
        if (!entry) continue;
        const newer = await invoke<boolean>("recovery_is_newer", {
          id,
          path: entry.path,
        }).catch(() => true);
        const answer = await ask({
          headline: "Recover unsaved work?",
          text: newer
            ? `Penwork closed with unsaved changes in "${entry.title}".`
            : `Penwork closed with unsaved changes in "${entry.title}", but the file has changed since. Saving what you recover would replace those changes.`,
          icon: "history",
          actions: [
            { value: "discard", label: "Discard" },
            { value: "recover", label: "Recover" },
          ],
          focus: "recover",
        });
        if (answer === "recover") {
          await useApp.getState().recoverDeck(id, entry.path, notify);
          return;
        }
        if (answer === "discard") await invoke("delete_recovery", { id });
      }
    })();
  }, [ready, ask, notify]);

  return dialog;
}
