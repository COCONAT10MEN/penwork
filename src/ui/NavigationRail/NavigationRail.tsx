import type { ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "../Icon";
import { Tooltip } from "../Tooltip/Tooltip";
import styles from "./NavigationRail.module.css";

export interface RailItem {
  id: string;
  label: string;
  icon: string;
  /** Small count badge, e.g. items in Trash. */
  badge?: number;
}

export interface NavigationRailProps {
  /** Name of the navigation landmark, e.g. "Main". */
  label: string;
  items: RailItem[];
  value: string;
  onChange: (id: string) => void;
  /** Wide: icon + label in a pill. Narrow: icons only, labels as tooltips. */
  expanded: boolean;
  /** Top slot (logo, FAB). */
  header?: ReactNode;
  /** Bottom slot (settings, storage). */
  footer?: ReactNode;
}

/** M3 Expressive navigation rail. The active destination gets a secondary-container pill. */
export function NavigationRail({
  label,
  items,
  value,
  onChange,
  expanded,
  header,
  footer,
}: NavigationRailProps) {
  return (
    <nav
      aria-label={label}
      className={cx(styles.rail, expanded ? styles.expanded : styles.collapsed)}
    >
      {header && <div className={styles.header}>{header}</div>}
      <ul className={styles.items}>
        {items.map((item) => {
          const active = item.id === value;
          const button = (
            <button
              type="button"
              aria-current={active ? "page" : undefined}
              aria-label={
                expanded
                  ? undefined
                  : item.badge
                    ? `${item.label}, ${item.badge} items`
                    : item.label
              }
              data-active={active || undefined}
              className={cx("pw-state", styles.item)}
              onClick={() => onChange(item.id)}
            >
              <span className={styles.iconWrap}>
                <Icon name={item.icon} filled={active} />
                {!!item.badge && (
                  <span className={styles.badge} aria-hidden="true">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              {expanded && <span className={styles.label}>{item.label}</span>}
              {!!item.badge && <span className="pw-visually-hidden">, {item.badge} items</span>}
            </button>
          );
          return (
            <li key={item.id}>
              {expanded ? (
                button
              ) : (
                <Tooltip text={item.label} placement="right" describes={false}>
                  {button}
                </Tooltip>
              )}
            </li>
          );
        })}
      </ul>
      {footer && <div className={styles.footer}>{footer}</div>}
    </nav>
  );
}
