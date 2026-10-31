import { useState } from "react";
import { useApp } from "../../appStore";
import { newDeck, type StartLayout } from "../../lib/deck/layouts";
import { Button, Dialog, SegmentedButton, TextField, useSnackbar } from "../../ui";
import styles from "./Home.module.css";

const LAYOUTS = [
  { value: "cover", label: "Cover" },
  { value: "columns", label: "Two columns" },
  { value: "quiz", label: "Quiz" },
];

export function NewDeckDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notify = useSnackbar();
  const createDeck = useApp((s) => s.createDeck);
  const [title, setTitle] = useState("");
  const [layout, setLayout] = useState<StartLayout>("cover");

  const create = () => {
    onClose();
    void createDeck(newDeck(title, layout), "New deck", notify);
    setTitle("");
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      headline="New deck"
      icon="add"
      material="glass"
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={create}>Create deck</Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <TextField label="Deck name" value={title} onChange={setTitle} />
        <SegmentedButton
          label="Start with"
          required
          options={LAYOUTS}
          value={layout}
          onChange={(value) => setLayout(value as StartLayout)}
        />
      </div>
    </Dialog>
  );
}
