import { Icon } from "../Icon";
import styles from "./Breadcrumb.module.css";

export interface BreadcrumbItem {
  /** Keeps React rows stable when two levels share a label. */
  id: string;
  label: string;
  /** Going back up to this level. The last item is the current one and ignores this. */
  onClick?: () => void;
}

/** Where you are, e.g. Slide 2 › Columns › Card. Earlier levels are clickable. */
export function Breadcrumb({ label, items }: { label: string; items: BreadcrumbItem[] }) {
  return (
    <nav aria-label={label}>
      <ol className={styles.list}>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.id} className={styles.item}>
              {last || !item.onClick ? (
                <span
                  className={last ? styles.current : styles.text}
                  aria-current={last ? "location" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <button type="button" className={`pw-state ${styles.link}`} onClick={item.onClick}>
                  {item.label}
                </button>
              )}
              {!last && <Icon name="chevron_right" size={16} className={styles.separator} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
