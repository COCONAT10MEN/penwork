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
        const answer = entry
          ? await ask({
              headline: "Recover unsaved work?",
              text: `Penwork closed with unsaved changes in "${entry.title}".`,
              icon: "history",
              actions: [
                { value: "discard", label: "Discard" },
                { value: "recover", label: "Recover" },
              ],
            })
          : null;
        if (answer === "recover" && entry) {
          await useApp.getState().recoverDeck(id, entry.path, notify);
          return;
        }
        if (answer === "discard" || !entry) await invoke("delete_recovery", { id });
      }
    })();
  }, [ready, ask, notify]);

  return dialog;
}
