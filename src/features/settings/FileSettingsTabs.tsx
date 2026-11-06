import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useApp } from "../../appStore";
import { Button, Switch, TextField } from "../../ui";
import { askGoAhead, notify, showError } from "../notices/notices";
import { Choice, Section } from "./parts";
import { useChoices } from "./useChoices";
import styles from "./Settings.module.css";
import { ToolbarSettings } from "./ToolbarSettings";

export function GeneralTab() {
  const { settings, update } = useChoices();
  const clearRecents = useApp((s) => s.clearRecents);

  const clear = async () => {
    const yes = await askGoAhead({
      title: "Clear recent files?",
      text: "They come off your lists, except favorites. The files themselves aren't touched.",
      ok: "Clear",
      cancel: "Cancel",
      icon: "playlist_remove",
    });
    if (yes) {
      clearRecents();
      notify("Recent files cleared.", "playlist_remove");
    }
  };

  return (
    <div className={styles.columns}>
      <Section title="Starting Penwork">
        <Choice
          label="What opens first"
          options={[
            { value: "home", label: "Home" },
            { value: "last", label: "My last file" },
          ]}
          value={settings.startOn}
          onChange={(startOn) => update({ startOn })}
        />
      </Section>
      <Section title="Recent files" hint="Favorites always stay on the list.">
        <Choice
          label="How many to keep"
          options={[
            { value: 25, label: "25" },
            { value: 50, label: "50" },
            { value: 100, label: "100" },
            { value: 0, label: "All" },
          ]}
          value={settings.recentLimit}
          onChange={(recentLimit) => update({ recentLimit })}
        />
        <Button variant="tonal" size="small" icon="playlist_remove" onClick={() => void clear()}>
          Clear recent files
        </Button>
      </Section>
    </div>
  );
}

export function FilesSavingTab() {
  const { settings, update } = useChoices();

  const chooseFolder = async () => {
    const folder = await open({ directory: true, multiple: false });
    if (typeof folder === "string") update({ saveFolder: folder });
  };

  return (
    <div className={styles.columns}>
      <Section title="Saving" hint="Where Save as starts when a file has no place yet.">
        <p className={styles.value}>{settings.saveFolder ?? "Chosen by Windows"}</p>
        <div className={styles.buttons}>
          <Button variant="tonal" size="small" icon="folder" onClick={() => void chooseFolder()}>
            Choose folder
          </Button>
          {settings.saveFolder && (
            <Button variant="text" size="small" onClick={() => update({ saveFolder: null })}>
              Let Windows choose
            </Button>
          )}
        </div>
      </Section>
      <Section
        title="Previous versions"
        hint="Word, Excel and PDF. Editing can drop parts of a file, so the replaced version can be kept."
      >
        <Switch
          label="Keep the old version on Save"
          description="One copy for each file, in Penwork's own folder."
          checked={settings.keepPrevious}
          onCheckedChange={(keepPrevious) => update({ keepPrevious })}
        />
        <Button
          variant="tonal"
          size="small"
          icon="folder_open"
          onClick={() => {
            invoke("open_app_folder", { name: "before-save" }).catch(() =>
              showError("That folder couldn't be opened."),
            );
          }}
        >
          Open that folder
        </Button>
      </Section>
      <Section
        title="Recovery"
        hint="Unsaved presentation work is copied to a separate file in case of a crash."
      >
        <Choice
          label="Copy every"
          options={[
            { value: 5, label: "5 sec" },
            { value: 15, label: "15 sec" },
            { value: 30, label: "30 sec" },
            { value: 60, label: "1 min" },
          ]}
          value={settings.recoverySeconds}
          onChange={(recoverySeconds) => update({ recoverySeconds })}
        />
      </Section>
    </div>
  );
}

export function WordTab() {
  const { settings, update } = useChoices();
  return (
    <div className={styles.columns}>
      <Section title="View">
        <Switch
          label="Show the ruler"
          checked={settings.wordRuler}
          onCheckedChange={(wordRuler) => update({ wordRuler })}
        />
        <Switch
          label="Show the outline button"
          description="Lists a document's headings and finds text."
          checked={settings.wordOutline}
          onCheckedChange={(wordOutline) => update({ wordOutline })}
        />
        <Choice
          label="Starting zoom"
          options={[
            { value: "fit", label: "Fit" },
            { value: "100", label: "100%" },
            { value: "125", label: "125%" },
            { value: "150", label: "150%" },
          ]}
          value={settings.wordZoom}
          onChange={(wordZoom) => update({ wordZoom })}
        />
      </Section>
      <Section title="Your name" hint="Shown on comments and tracked changes.">
        <TextField
          label="Author name"
          value={settings.wordAuthor}
          maxLength={80}
          onChange={(wordAuthor) => update({ wordAuthor })}
        />
      </Section>
    </div>
  );
}

export function SheetTab() {
  const { settings, update } = useChoices();
  return (
    <div className={styles.columns}>
      <Section title="View">
        <Switch
          label="Show gridlines"
          checked={settings.sheetGridlines}
          onCheckedChange={(sheetGridlines) => update({ sheetGridlines })}
        />
        <Choice
          label="Starting zoom"
          options={[
            { value: 0.75, label: "75%" },
            { value: 1, label: "100%" },
            { value: 1.25, label: "125%" },
            { value: 1.5, label: "150%" },
          ]}
          value={settings.sheetZoom}
          onChange={(sheetZoom) => update({ sheetZoom })}
        />
      </Section>
      <Section title="Text">
        <Choice
          label="Font size in new cells"
          options={[
            { value: 10, label: "10" },
            { value: 11, label: "11" },
            { value: 12, label: "12" },
            { value: 14, label: "14" },
          ]}
          value={settings.sheetFontSize}
          onChange={(sheetFontSize) => update({ sheetFontSize })}
        />
      </Section>
    </div>
  );
}

export function PdfTab() {
  const { settings, update } = useChoices();
  return (
    <div className={styles.columns}>
      <Section title="View">
        <Choice
          label="Starting zoom"
          options={[
            { value: "page-width", label: "Fit width" },
            { value: "page-fit", label: "Whole page" },
            { value: "100", label: "100%" },
          ]}
          value={settings.pdfZoom}
          onChange={(pdfZoom) => update({ pdfZoom })}
        />
        <Switch
          label="Hide the top bar while reading"
          description="Slides away as you scroll down. Scroll up or point at the top to bring it back."
          checked={settings.pdfHideBar}
          onCheckedChange={(pdfHideBar) => update({ pdfHideBar })}
        />
        <Switch
          label="Two pages side by side"
          checked={settings.pdfTwoPages}
          onCheckedChange={(pdfTwoPages) => update({ pdfTwoPages })}
        />
        <Switch
          label="Editing"
          description="Pens, shapes, Edit tools and text styling. Off is read-only."
          checked={settings.pdfInk}
          onCheckedChange={(pdfInk) => update({ pdfInk })}
        />
      </Section>
      <ToolbarSettings kind="pdf" />
    </div>
  );
}
