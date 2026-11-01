import { AnimatePresence, motion } from "motion/react";
import type { Ref } from "react";
import { useSpring } from "../../theme/motion";
import { IconButton, SplitButton, Surface } from "../../ui";
import styles from "./DeckView.module.css";

export function EditHeader({
  title,
  dirty,
  saving,
  canUndo,
  canRedo,
  presentRef,
  onBack,
  onUndo,
  onRedo,
  onSave,
  onSaveAs,
  onPresent,
  onPresentFromStart,
}: {
  title: string;
  dirty: boolean;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  presentRef: Ref<HTMLButtonElement>;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onPresent: () => void;
  onPresentFromStart: () => void;
}) {
  const fade = useSpring("effectsDefault");
  const status = saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved";
  return (
    <Surface material="glass" floating className={styles.header}>
      <IconButton icon="arrow_back" label="Back to Home" onClick={onBack} />
      <div className={styles.titles}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.saved} data-dirty={dirty || undefined}>
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
      <div className={styles.history} role="group" aria-label="Undo and save" data-press-group>
        <IconButton size="compact" icon="undo" label="Undo" disabled={!canUndo} onClick={onUndo} />
        <IconButton size="compact" icon="redo" label="Redo" disabled={!canRedo} onClick={onRedo} />
        <IconButton size="compact" icon="save" label="Save" onClick={onSave} />
        <IconButton size="compact" icon="save_as" label="Save as" onClick={onSaveAs} />
      </div>
      <SplitButton
        size="compact"
        label="Present"
        icon="play_arrow"
        iconFilled
        mainLabel="Present from this slide"
        mainRef={presentRef}
        onClick={onPresent}
        menuLabel="More ways to present"
        menuMaterial="glass"
        items={[
          { label: "From the start", icon: "first_page", onSelect: onPresentFromStart },
          { label: "From this slide", icon: "play_arrow", onSelect: onPresent },
        ]}
      />
    </Surface>
  );
}
