import { getVersion } from "@tauri-apps/api/app";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Button, Switch } from "../../ui";
import { exportToolbar, importToolbar, loadToolbar, saveToolbar } from "../deck/toolbarFile";
import { askGoAhead, notify, showError } from "../notices/notices";
import { saveAiKit } from "./aiKit";
import { Choice, Section } from "./parts";
import { useChoices } from "./useChoices";
import { DEFAULT_SETTINGS } from "./settingsFile";
import styles from "./Settings.module.css";

export function AnimationsTab() {
  const { settings, update } = useChoices();
  return (
    <div className={styles.columns}>
      <Section title="Motion">
        <Switch
          label="Reduce motion"
          description="When this is off, Penwork follows your Windows setting."
          checked={settings.reduceMotion}
          onCheckedChange={(reduceMotion) => update({ reduceMotion })}
        />
        <Choice
          label="Animation speed"
          options={[
            { value: "slow", label: "Slower" },
            { value: "normal", label: "Normal" },
            { value: "fast", label: "Faster" },
          ]}
          value={settings.animationSpeed}
          onChange={(animationSpeed) => update({ animationSpeed })}
        />
        <p className={styles.hint}>The slide toolbar keeps its own timing.</p>
      </Section>
      <Section title="Opening a file">
        <Switch
          label="Opening animation"
          description="The tools appear one after another and the page rises into place."
          checked={settings.openingAnimation}
          onCheckedChange={(openingAnimation) => update({ openingAnimation })}
        />
      </Section>
    </div>
  );
}

function ToolbarSection() {
  const exportIt = async () => {
    const toolbar = await loadToolbar();
    await exportToolbar(JSON.stringify(toolbar ?? {}, null, 2));
  };

  const importIt = () =>
    importToolbar((text) => {
      try {
        const data: unknown = JSON.parse(text);
        if (typeof data !== "object" || data === null) throw new Error("not settings");
        saveToolbar(data as Record<string, unknown>);
        notify("Toolbar settings imported.");
      } catch {
        showError("That file doesn't hold toolbar settings.");
      }
    });

  const reset = async () => {
    const yes = await askGoAhead({
      title: "Reset the slide toolbar?",
      text: "Its tools, colours and sizes go back to how they started.",
      ok: "Reset",
      cancel: "Cancel",
      icon: "restart_alt",
    });
    if (!yes) return;
    saveToolbar({});
    notify("Slide toolbar reset.", "restart_alt");
  };

  return (
    <Section
      title="Slide toolbar"
      hint="Its tools, colours and sizes are changed on the toolbar itself during a show. This moves them between computers."
    >
      <div className={styles.buttons}>
        <Button variant="tonal" size="small" icon="upload" onClick={() => void importIt()}>
          Import
        </Button>
        <Button variant="tonal" size="small" icon="download" onClick={() => void exportIt()}>
          Export
        </Button>
        <Button variant="text" size="small" onClick={() => void reset()}>
          Reset
        </Button>
      </div>
    </Section>
  );
}

export function PresentationsTab() {
  const { settings, update } = useChoices();
  return (
    <div className={styles.columns}>
      <Section title="During a show">
        <Choice
          label="After the last slide"
          options={[
            { value: "loop", label: "Back to the first" },
            { value: "stop", label: "Stay on it" },
          ]}
          value={settings.endOfShow}
          onChange={(endOfShow) => update({ endOfShow })}
        />
      </Section>
      <Section
        title="New presentations"
        hint="Each presentation can change this in its own settings."
      >
        <Switch
          label="Keep ink in the file"
          description="Off keeps ink on this computer only."
          checked={settings.newKeepInk}
          onCheckedChange={(newKeepInk) => update({ newKeepInk })}
        />
      </Section>
      <ToolbarSection />
    </div>
  );
}

export function AiTab() {
  return (
    <div className={styles.columns}>
      <Section
        title="AI kit"
        hint="What an AI needs to write a Penwork presentation: the guide, a packing tool, an example and a prompt."
      >
        <Button variant="tonal" size="small" icon="download" onClick={() => void saveAiKit()}>
          Get the AI kit
        </Button>
      </Section>
    </div>
  );
}

const SHORTCUTS: { title: string; keys: [string, string][] }[] = [
  {
    title: "Everywhere",
    keys: [
      ["Ctrl + S", "Save"],
      ["Ctrl + Z", "Undo"],
      ["Ctrl + Y", "Redo"],
      ["Enter", "Finish renaming a file"],
      ["Esc", "Cancel renaming a file"],
    ],
  },
  {
    title: "Word",
    keys: [
      ["Ctrl + O", "Open a file"],
      ["Ctrl + B", "Bold"],
      ["Ctrl + I", "Italic"],
      ["Ctrl + U", "Underline"],
    ],
  },
  {
    title: "Spreadsheets",
    keys: [
      ["Ctrl + B", "Bold"],
      ["Ctrl + I", "Italic"],
      ["Ctrl + D", "Fill down"],
      ["Ctrl + R", "Fill right"],
      ["Shift + Arrows", "Select cells"],
    ],
  },
  {
    title: "PDF",
    keys: [
      ["Enter", "Next match, in Find"],
      ["Shift + Enter", "Previous match"],
    ],
  },
  {
    title: "Presentations",
    keys: [
      ["F5", "Present"],
      ["Right, Down, Space", "Next"],
      ["Left, Up, Backspace", "Back"],
      ["Home, End", "First or last slide"],
      ["F", "End the show"],
      ["G", "See all slides"],
      ["W", "Whiteboard"],
      ["A", "Drawing on or off"],
      ["P", "Pen"],
      ["H", "Highlighter"],
      ["L", "Laser pointer"],
      ["E", "Eraser"],
      ["C", "Clear ink"],
    ],
  },
];

export function ShortcutsTab() {
  return (
    <div className={styles.columns}>
      {SHORTCUTS.map(({ title, keys }) => (
        <Section key={title} title={title}>
          <dl className={styles.keys}>
            {keys.map(([key, what]) => (
              <div key={key} className={styles.key}>
                <dt>{key}</dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ))}
    </div>
  );
}

export function AboutTab() {
  const { update } = useChoices();
  const [version, setVersion] = useState("");
  useEffect(() => {
    if (isTauri()) void getVersion().then(setVersion);
  }, []);

  const resetAll = async () => {
    const yes = await askGoAhead({
      title: "Reset all settings?",
      text: "Everything on these tabs goes back to how it started. Your files and the slide toolbar aren't touched.",
      ok: "Reset",
      cancel: "Cancel",
      icon: "restart_alt",
    });
    if (yes) {
      update(DEFAULT_SETTINGS);
      notify("Settings reset.", "restart_alt");
    }
  };

  return (
    <div className={styles.columns}>
      <Section title="Penwork" hint={version ? `Version ${version}` : undefined}>
        <p className={styles.hint}>
          An office suite for Windows: presentations, documents, spreadsheets and PDFs.
        </p>
      </Section>
      <Section
        title="Credits"
        hint="Penwork is built on free, open-source work. Word uses docx-editor, spreadsheets use FortuneSheet, FortuneExcel and ExcelJS, and PDFs use PDF.js."
      >
        <Button
          variant="tonal"
          size="small"
          icon="description"
          onClick={() => {
            invoke("open_app_folder", { name: "licenses" }).catch(() =>
              showError("That folder couldn't be opened."),
            );
          }}
        >
          Open the licences
        </Button>
      </Section>
      <Section title="Start again">
        <Button variant="tonal" size="small" icon="restart_alt" onClick={() => void resetAll()}>
          Reset all settings
        </Button>
      </Section>
    </div>
  );
}
