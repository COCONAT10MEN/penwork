import type { Ref } from "react";
import { Button, IconButton, Surface } from "../../ui";
import { slidesLabel } from "../library/greeting";
import styles from "./DeckView.module.css";

export function EditHeader({
  title,
  total,
  dirty,
  canUndo,
  canRedo,
  presentRef,
  onBack,
  onUndo,
  onRedo,
  onSave,
  onSaveAs,
  onPresent,
}: {
  title: string;
  total: number;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  presentRef: Ref<HTMLButtonElement>;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onPresent: () => void;
}) {
  return (
    <Surface material="glass" floating className={styles.header}>
      <IconButton icon="arrow_back" label="Back to Home" onClick={onBack} />
      <div className={styles.titles}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.meta}>
          {slidesLabel(total)} ·{" "}
          <span className={styles.saved} data-dirty={dirty || undefined}>
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
        </p>
      </div>
      <div className={styles.history} role="group" aria-label="Undo and save">
        <IconButton icon="undo" label="Undo" disabled={!canUndo} onClick={onUndo} />
        <IconButton icon="redo" label="Redo" disabled={!canRedo} onClick={onRedo} />
        <IconButton icon="save" label="Save" onClick={onSave} />
        <IconButton icon="save_as" label="Save as" onClick={onSaveAs} />
      </div>
      <Button
        ref={presentRef}
        size="medium"
        icon="play_arrow"
        aria-label="Present from this slide"
        onClick={onPresent}
      >
        Present
      </Button>
    </Surface>
  );
}
