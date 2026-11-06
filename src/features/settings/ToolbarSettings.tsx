import { useContext, useEffect, useState } from "react";
import { IconButton, Switch } from "../../ui";
import { loadToolbar, saveToolbar } from "../deck/toolbarFile";
import { Choice, Section } from "./parts";
import { ToolbarLive } from "./settingsContexts";
import styles from "./Settings.module.css";

/**
 * The annotation toolbar's own settings, here rather than on the toolbar: the same file the toolbar
 * in a presentation and on a PDF reads when it opens (toolbar.json).
 */

type Ui = {
  tool?: string;
  tablet?: string;
  tapAgain?: boolean;
  dbl?: boolean;
  rclick?: boolean;
  order?: string[];
  hidden?: string[];
};

const BUTTONS: Record<string, string> = {
  ptr: "Pointer",
  pen: "Pen",
  hl: "Highlighter",
  laser: "Laser pointer",
  eraser: "Eraser",
  undo: "Undo",
  redo: "Redo",
  clear: "Clear",
  hide: "Show / hide ink",
  wb: "Whiteboard",
  grid: "All slides",
  full: "End show",
};
/** A PDF has no slides, whiteboard or show, and always shows its ink. */
const SLIDES_ONLY = new Set(["hide", "wb", "grid", "full"]);
const DEFAULT_ORDER = Object.keys(BUTTONS);

/** On the PDF tab only what a PDF's toolbar has; on the Presentations tab every button. */
export function ToolbarSettings({ kind }: { kind: "pdf" | "deck" }) {
  const [file, setFile] = useState<Record<string, unknown> | null>(null);
  const live = useContext(ToolbarLive);
  useEffect(() => {
    void loadToolbar().then((t) => setFile(t ?? {}));
  }, []);
  if (!file) return null;
  const ui = (file.ui ?? {}) as Ui;
  const update = (patch: Ui) => {
    const next = { v: 1, ...file, ui: { ...ui, ...patch } };
    setFile(next);
    saveToolbar(next);
    live?.(next);
  };
  const order = [...(ui.order ?? []), ...DEFAULT_ORDER].filter(
    (id, i, all) => BUTTONS[id] && all.indexOf(id) === i,
  );
  const shown = kind === "pdf" ? order.filter((id) => !SLIDES_ONLY.has(id)) : order;
  const hidden = ui.hidden ?? [];
  // Moves past the next button on this list, stepping over any this tab doesn't show.
  const move = (id: string, by: number) => {
    const neighbour = shown[shown.indexOf(id) + by];
    if (!neighbour) return;
    const next = [...order];
    const at = next.indexOf(id);
    const to = next.indexOf(neighbour);
    [next[at], next[to]] = [neighbour, id];
    update({ order: next });
  };

  return (
    <Section
      title="Annotation toolbar"
      hint={
        kind === "pdf"
          ? "Shared with presentations. Pen colours and sizes are set on the pens themselves."
          : "Shared with PDFs. Pen colours and sizes are set on the pens themselves."
      }
    >
      <Choice
        label="Starting tool"
        options={[
          { value: "pen", label: "Pen" },
          { value: "hl", label: "Highlighter" },
          { value: "laser", label: "Laser" },
          { value: "eraser", label: "Eraser" },
        ]}
        value={ui.tool ?? "pen"}
        onChange={(tool) => update({ tool })}
      />
      <Choice
        label="Tablet mode: larger buttons"
        options={[
          { value: "auto", label: "Auto" },
          { value: "on", label: "On" },
          { value: "off", label: "Off" },
        ]}
        value={ui.tablet ?? "on"}
        onChange={(tablet) => update({ tablet })}
      />
      <Switch
        label="Tap a selected tool again for its settings"
        checked={ui.tapAgain !== false}
        onCheckedChange={(tapAgain) => update({ tapAgain })}
      />
      <Switch
        label="Double-tap a tool for its settings"
        checked={ui.dbl !== false}
        onCheckedChange={(dbl) => update({ dbl })}
      />
      <Switch
        label="Right-click a tool for its settings"
        description="A long press does the same on touch."
        checked={ui.rclick !== false}
        onCheckedChange={(rclick) => update({ rclick })}
      />
      <span className={styles.subtitle}>Buttons</span>
      <ul className={styles.buttonList}>
        {shown.map((id, i) => (
          <li key={id} className={styles.buttonRow}>
            <Switch
              label={BUTTONS[id] ?? id}
              checked={!hidden.includes(id)}
              onCheckedChange={(on) =>
                update({ hidden: on ? hidden.filter((h) => h !== id) : [...hidden, id] })
              }
            />
            <IconButton
              icon="keyboard_arrow_up"
              label={`Move ${BUTTONS[id]} up`}
              disabled={i === 0}
              onClick={() => move(id, -1)}
            />
            <IconButton
              icon="keyboard_arrow_down"
              label={`Move ${BUTTONS[id]} down`}
              disabled={i === shown.length - 1}
              onClick={() => move(id, 1)}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}
