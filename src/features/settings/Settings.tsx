import { useState } from "react";
import { SharedAxis, Tabs, type TabItem } from "../../ui";
import { AppearanceTab } from "./AppearanceTab";
import { AboutTab, AiTab, AnimationsTab, PresentationsTab, ShortcutsTab } from "./AppTabs";
import { FilesSavingTab, GeneralTab, PdfTab, SheetTab, WordTab } from "./FileSettingsTabs";
import styles from "./Settings.module.css";

const TABS: TabItem[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "animations", label: "Animations" },
  { id: "files", label: "Files & saving" },
  { id: "word", label: "Word" },
  { id: "sheet", label: "Spreadsheets" },
  { id: "pdf", label: "PDF" },
  { id: "deck", label: "Presentations" },
  { id: "ai", label: "AI" },
  { id: "keys", label: "Shortcuts" },
  { id: "about", label: "About" },
];

const ORDER = TABS.map((t) => t.id);

const PAGES: Record<string, () => React.JSX.Element> = {
  general: GeneralTab,
  appearance: AppearanceTab,
  animations: AnimationsTab,
  files: FilesSavingTab,
  word: WordTab,
  sheet: SheetTab,
  pdf: PdfTab,
  deck: PresentationsTab,
  ai: AiTab,
  keys: ShortcutsTab,
  about: AboutTab,
};

export function Settings() {
  const [tab, setTab] = useState("general");
  const Page = PAGES[tab] ?? GeneralTab;
  return (
    <div className={styles.settings}>
      <h1 className={styles.heading}>Settings</h1>
      <Tabs label="Settings" tabs={TABS} value={tab} onChange={setTab} />
      <SharedAxis id={tab} order={ORDER} label={TABS.find((t) => t.id === tab)?.label}>
        <Page />
      </SharedAxis>
    </div>
  );
}
