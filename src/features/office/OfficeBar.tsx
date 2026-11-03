import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type Ref } from "react";
import { fileExtension, fileStem, nameProblem } from "../../lib/office";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { IconButton, SplitButton, Surface } from "../../ui";
import { showError } from "../notices/notices";
import styles from "./OfficeBar.module.css";

/** Looks like a title, and is a text box the moment it's clicked, as in Google Docs. */
function NameField({
  name,
  onRename,
}: {
  name: string;
  onRename: (name: string) => Promise<void>;
}) {
  const stem = fileStem(name);
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);

  const commit = async () => {
    if (draft === null) return;
    const wanted = draft.trim();
    setDraft(null);
    if (cancelled.current || !wanted || wanted === stem) return;
    const problem = nameProblem(wanted);
    if (problem) {
      showError(problem);
      return;
    }
    await onRename(`${wanted}.${fileExtension(name)}`);
  };

  return (
    <input
      className={styles.name}
      value={draft ?? stem}
      aria-label="File name"
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => {
        cancelled.current = false;
        setDraft(stem);
        e.target.select();
      }}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/** The one bar at the top of every document. The tools of whichever editor is open go in `slotRef`. */
export function OfficeBar({
  name,
  status,
  dirty,
  hasMenus,
  docked = false,
  hidden = false,
  menusOpen,
  slotRef,
  onBack,
  onRename,
  onMenus,
  onSave,
  onSaveAs,
}: {
  name: string;
  status: string;
  dirty: boolean;
  hasMenus: boolean;
  /** Attached across the top of the window, instead of floating. */
  docked?: boolean;
  /** Slid out of sight, for reading. */
  hidden?: boolean;
  menusOpen: boolean;
  slotRef: Ref<HTMLDivElement>;
  onBack: () => void;
  onRename: (name: string) => Promise<void>;
  onMenus: () => void;
  onSave: () => void;
  onSaveAs: () => void;
}) {
  const reduce = useReduceMotion();
  const glide = useSpring("spatialDefault");
  const fade = useSpring("effectsDefault");
  return (
    <motion.div
      className={styles.place}
      data-docked={docked || undefined}
      data-hidden={hidden || undefined}
      inert={hidden}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -28, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: glide }}
    >
      <Surface material="glass" floating className={styles.bar}>
        <IconButton icon="arrow_back" label="Back to Home" onClick={onBack} />
        <div className={styles.titles}>
          <NameField name={name} onRename={onRename} />
          <p className={styles.status} data-dirty={dirty || undefined}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={status}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0, transition: fade }}
                exit={{ opacity: 0, y: -5, transition: fade }}
              >
                {status}
              </motion.span>
            </AnimatePresence>
          </p>
        </div>
        <div ref={slotRef} className={styles.slot} />
        {hasMenus && (
          <IconButton
            size="compact"
            icon="menu"
            label="Menus"
            selected={menusOpen}
            onClick={onMenus}
          />
        )}
        <SplitButton
          size="compact"
          variant={dirty ? "filled" : "tonal"}
          label="Save"
          icon="save"
          mainLabel="Save"
          onClick={onSave}
          menuLabel="More ways to save"
          menuMaterial="glass"
          items={[{ label: "Save as", icon: "save_as", onSelect: onSaveAs }]}
        />
      </Surface>
    </motion.div>
  );
}
