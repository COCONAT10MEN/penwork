import { SHAPES, shapeSvg } from "../../lib/pdftools/shapes";
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

/** The Shapes tab: each shape as a tile; picking one opens Shapes with it chosen. */
export function ShapeGrid({ onPick }: { onPick: (shape: string) => void }) {
  return (
    <div className={styles.grid3}>
      {SHAPES.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`pw-state pw-press ${styles.tile}`}
          onClick={() => onPick(s.id)}
        >
          <span
            className={styles.tileIcon}
            // Our own drawing of the shape, from the shapes list.
            dangerouslySetInnerHTML={{ __html: shapeSvg(s.id, 28, 28) }}
          />
          <span className={styles.tileName}>{s.label}</span>
        </button>
      ))}
    </div>
  );
}
