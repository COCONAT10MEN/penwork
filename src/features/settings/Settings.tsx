import { motion } from "motion/react";
import { useState } from "react";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { Tabs, type TabItem } from "../../ui";
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
  const reduce = useReduceMotion();
  const rise = useSpring("spatialDefault");
  const Page = PAGES[tab] ?? GeneralTab;
  return (
    <div className={styles.settings}>
      <h1 className={styles.heading}>Settings</h1>
      <Tabs label="Settings" tabs={TABS} value={tab} onChange={setTab} />
      <motion.div
        key={tab}
        role="tabpanel"
        aria-label={TABS.find((t) => t.id === tab)?.label}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, transition: rise }}
      >
        <Page />
      </motion.div>
    </div>
  );
}
