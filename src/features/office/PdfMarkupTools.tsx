import { motion } from "motion/react";
import { useState } from "react";
import { IconButton } from "../../ui";
import { PenSettings } from "./PenSettings";
import { useToolArrival } from "./toolMotion";
import type { DocState, ToolId } from "./useReader";
import styles from "./OfficeView.module.css";

const TOOLS: { id: ToolId | "ptr"; label: string; icon: string }[] = [
  { id: "ptr", label: "Pointer: select text and follow links", icon: "arrow_selector_tool" },
  { id: "pen", label: "Pen (P)", icon: "stylus" },
  { id: "hl", label: "Highlighter (H)", icon: "ink_highlighter" },
  { id: "laser", label: "Laser pointer (L)", icon: "flare" },
  { id: "eraser", label: "Eraser (E)", icon: "ink_eraser" },
];

/**
 * The slide toolbar's tools, in the top bar. Tapping the tool in use again opens its settings, as
 * on the slide toolbar. Each tool's colour shows under it.
 */
export function PdfMarkupTools({
  state,
  onUse,
  onAct,
  onSet,
}: {
  state: DocState;
  onUse: (tool: ToolId | "ptr") => void;
  onAct: (action: "undo" | "redo" | "clear" | "hide") => void;
  onSet: (tool: ToolId, patch: Record<string, unknown>) => void;
}) {
  const arrive = useToolArrival();
  const [settings, setSettings] = useState<{ tool: ToolId; anchor: HTMLElement } | null>(null);
  const current = state.annot ? state.tool : "ptr";

  return (
    <>
      {TOOLS.map(({ id, label, icon }) => {
        const colour = id !== "ptr" && id !== "eraser" ? state.cfg[id]?.c : undefined;
        return (
          <motion.span key={id} className={styles.markTool} variants={arrive}>
            <IconButton
              size="compact"
              icon={icon}
              label={label}
              selected={current === id}
              aria-haspopup={id !== "ptr" ? "dialog" : undefined}
              onClick={(e) => {
                if (id !== "ptr" && current === id) {
                  const anchor = e.currentTarget;
                  setSettings((open) => (open?.tool === id ? null : { tool: id, anchor }));
                } else {
                  setSettings(null);
                  onUse(id);
                }
              }}
            />
            {colour && <span className={styles.markColour} style={{ background: colour }} />}
          </motion.span>
        );
      })}
      <motion.span className={styles.pdfDivider} variants={arrive} />
      <motion.span className={styles.toolSlot} variants={arrive}>
        <IconButton
          size="compact"
          icon="undo"
          label="Undo (Ctrl+Z)"
          disabled={!state.undo}
          onClick={() => onAct("undo")}
        />
      </motion.span>
      <motion.span className={styles.toolSlot} variants={arrive}>
        <IconButton
          size="compact"
          icon="redo"
          label="Redo (Ctrl+Y)"
          disabled={!state.redo}
          onClick={() => onAct("redo")}
        />
      </motion.span>
      <motion.span className={styles.toolSlot} variants={arrive}>
        <IconButton
          size="compact"
          icon="delete_sweep"
          label="Clear this page (C)"
          disabled={!state.clear}
          onClick={() => onAct("clear")}
        />
      </motion.span>
      <motion.span className={styles.toolSlot} variants={arrive}>
        <IconButton
          size="compact"
          icon={state.hidden ? "visibility_off" : "visibility"}
          label={state.hidden ? "Show ink" : "Hide ink"}
          selected={state.hidden}
          onClick={() => onAct("hide")}
        />
      </motion.span>
      <PenSettings
        tool={settings?.tool ?? null}
        anchor={settings?.anchor ?? null}
        state={state}
        onSet={onSet}
        onClose={() => setSettings(null)}
      />
    </>
  );
}
