import { useState, type ReactNode } from "react";
import { Button, ColorPicker, ColorSwatches, Dialog, IconButton, TextField } from "../../../ui";
import styles from "./Inspector.module.css";

/** What a field needs to change the picked element. */
export interface Editing {
  /** The picked element in the clean copy. A copy to read from: use `change` to change it. */
  element: Element;
  /** The whole slide in the clean copy, for what's outside the element. */
  slide: Element;
  /** The open presentation, for adding files to it. */
  token: string;
  change: (change: (element: Element) => void) => void;
  /** Shows a change on the slide straight away, without saving it. */
  preview: (message: { prop?: string; value?: string; tex?: string }) => void;
}

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className={styles.group}>
      {title && <h3 className={styles.groupTitle}>{title}</h3>}
      {children}
    </section>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className={styles.hint}>{children}</p>;
}

/** Saves when focus leaves or Enter is pressed: one change, one undo step, not one per letter. */
export function CommitField({
  label,
  value,
  onCommit,
  onType,
  supporting,
  error,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  onType?: (value: string) => void;
  supporting?: string;
  error?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <TextField
      label={label}
      value={draft}
      supporting={supporting}
      error={error}
      spellCheck={false}
      onChange={(next) => {
        setDraft(next);
        onType?.(next);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(value);
      }}
    />
  );
}

/** A longer piece of text, such as an SVG's source or speaker notes. */
export function CommitArea({
  label,
  value,
  rows,
  onCommit,
}: {
  label: string;
  value: string;
  rows: number;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return (
    <label className={styles.area}>
      <span className={styles.groupTitle}>{label}</span>
      <textarea
        className={styles.textarea}
        rows={rows}
        value={draft}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
      />
    </label>
  );
}

/** A row in a list of things: move it, take it out. */
export function RowTools({
  label,
  onUp,
  onDown,
  onRemove,
}: {
  label: string;
  onUp?: () => void;
  onDown?: () => void;
  onRemove?: () => void;
}) {
  return (
    <span className={styles.rowTools}>
      <IconButton
        icon="arrow_upward"
        label={`Move ${label} up`}
        disabled={!onUp}
        tooltip={false}
        onClick={onUp}
      />
      <IconButton
        icon="arrow_downward"
        label={`Move ${label} down`}
        disabled={!onDown}
        tooltip={false}
        onClick={onDown}
      />
      <IconButton
        icon="close"
        label={`Remove ${label}`}
        disabled={!onRemove}
        tooltip={false}
        onClick={onRemove}
      />
    </span>
  );
}

const SWATCHES = ["#c0562f", "#0e7f9e", "#2e7d32", "#7a4fbf", "#b4287a", "#111111"];

function hexOf(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#111111";
}

/** The colour of a whole piece of text. Part of one is coloured from the toolbar on the slide. */
export function ColourField({ edit }: { edit: Editing }) {
  const [open, setOpen] = useState(false);
  const color = hexOf((edit.element as HTMLElement).style.color);
  const set = (hex: string) =>
    edit.change((el) => {
      (el as HTMLElement).style.color = hex;
    });
  return (
    <Group title="Colour">
      <ColorSwatches label="Text colour" colors={SWATCHES} value={color} onChange={set} />
      <div className={styles.buttons}>
        <Button variant="tonal" size="small" icon="palette" onClick={() => setOpen(true)}>
          Any colour
        </Button>
        <Button
          variant="text"
          size="small"
          onClick={() =>
            edit.change((el) => {
              (el as HTMLElement).style.removeProperty("color");
            })
          }
        >
          Reset
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        headline="Text colour"
        material="glass"
        actions={
          <Button size="medium" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <ColorPicker value={color} onChange={set} />
      </Dialog>
    </Group>
  );
}
