import { Icon, Tooltip } from "../../ui";
import type { Tool } from "./types";
import styles from "./PdfTools.module.css";

/** A tab's tools as tiles: the icon in a soft square, its name under it, what it does on hover. */
export function ToolGrid({ tools, onPick }: { tools: Tool[]; onPick: (tool: Tool) => void }) {
  return (
    <div className={styles.grid3}>
      {tools.map((t) => (
        <Tooltip key={t.id} text={t.blurb} describes>
          <button
            type="button"
            className={`pw-state pw-press ${styles.tile}`}
            onClick={() => onPick(t)}
          >
            <span className={styles.tileIcon}>
              <Icon name={t.icon} size={24} />
            </span>
            <span className={styles.tileName}>{t.title}</span>
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
