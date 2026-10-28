import type { ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "../Icon";
import styles from "./List.module.css";

export function List({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <ul className={styles.list} aria-label={label}>
      {children}
    </ul>
  );
}

export interface ListItemProps {
  headline: string;
  supporting?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  /** Makes the row a button. */
  onClick?: () => void;
}

/** One row: 56px with one line, 72px with supporting text. 20px corners in panels. */
export function ListItem({
  headline,
  supporting,
  leading,
  trailing,
  selected,
  onClick,
}: ListItemProps) {
  const content = (
    <>
      {leading && <span className={styles.leading}>{leading}</span>}
      <span className={styles.text}>
        <span className={styles.headline}>{headline}</span>
        {supporting && <span className={styles.supporting}>{supporting}</span>}
      </span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </>
  );
  const classes = cx(styles.item, supporting && styles.twoLine, onClick && "pw-state");
  return (
    <li className={styles.row}>
      {onClick ? (
        <button
          type="button"
          className={classes}
          aria-current={selected || undefined}
          data-selected={selected || undefined}
          onClick={onClick}
        >
          {content}
        </button>
      ) : (
        <div className={classes} data-selected={selected || undefined}>
          {content}
        </div>
      )}
    </li>
  );
}

export type ListIconColor = "primary" | "secondary" | "tertiary" | "error";

/** Icon in a shaped tonal container, for leading slots (annotation list, settings rows). */
export function ListIcon({ icon, color = "secondary" }: { icon: string; color?: ListIconColor }) {
  return (
    <span className={cx(styles.listIcon, styles[`icon-${color}`])}>
      <Icon name={icon} size={20} />
    </span>
  );
}
