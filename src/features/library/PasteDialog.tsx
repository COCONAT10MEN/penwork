import { useCallback, useEffect, useState } from "react";
import { useApp } from "../../appStore";
import { importPaste, type DeckParts } from "../../lib/deck/importPaste";
import { Button, Dialog, TextField, useSnackbar } from "../../ui";
import { slidesLabel } from "./greeting";
import styles from "./Home.module.css";

function countSlides(deck: DeckParts): number {
  return deck.slidesHtml.match(/<section\b/gi)?.length ?? 0;
}

/** Reads the clipboard when it opens, so copying a reply and clicking one button is enough. */
export function PasteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notify = useSnackbar();
  const createDeck = useApp((s) => s.createDeck);
  const [deck, setDeck] = useState<DeckParts | null>(null);
  const [title, setTitle] = useState("");
  const [checked, setChecked] = useState(false);

  const check = useCallback(async () => {
    const text = await navigator.clipboard.readText().catch(() => "");
    const found = importPaste(text);
    setDeck(found);
    setTitle(found?.title ?? "");
    setChecked(true);
  }, []);

  useEffect(() => {
    if (open) void Promise.resolve().then(check);
  }, [open, check]);

  const create = () => {
    if (!deck) return;
    onClose();
    void createDeck({ ...deck, title: title.trim() || deck.title }, "Paste from AI", notify);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      headline="Paste from AI"
      icon="content_paste"
      material="glass"
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            Cancel
          </Button>
          {deck ? (
            <Button onClick={create}>Create deck</Button>
          ) : (
            <Button variant="tonal" onClick={() => void check()}>
              Check again
            </Button>
          )}
        </>
      }
    >
      {deck ? (
        <div className={styles.dialogBody}>
          <p className={styles.sub}>Found {slidesLabel(countSlides(deck))} on the clipboard.</p>
          <TextField label="Deck name" value={title} onChange={setTitle} />
        </div>
      ) : (
        <p className={styles.sub}>
          {checked
            ? "There are no slides on the clipboard. Copy Claude's reply, then press Check again."
            : "Reading the clipboard…"}
        </p>
      )}
    </Dialog>
  );
}
