import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { useSpring } from "../../theme/motion";
import { cx } from "../cx";
import { surfaceClass, type SurfaceMaterial } from "../Surface/Surface";
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
  /**
   * "stacked": a slim rail with a small label under each icon, as in the Home mockup.
   * "wide": icon and label in a pill. "icons": icons only, labels as tooltips.
   */
  layout: "stacked" | "wide" | "icons";
  /** Top slot (logo, FAB). */
  header?: ReactNode;
  /** Bottom slot (settings, storage). */
  footer?: ReactNode;
  /** Destinations at the bottom of the rail, drawn like the others. */
  footerItems?: RailItem[];
  /** "glass" for floating chrome; "tonal" (default) is the solid look. */
  material?: SurfaceMaterial;
}

/** M3 Expressive navigation rail. The active destination gets a secondary-container pill. */
export function NavigationRail({
  label,
  items,
  value,
  onChange,
  layout,
  header,
  footer,
  footerItems = [],
  material = "tonal",
}: NavigationRailProps) {
  const pill = useId();
  const slide = useSpring("spatialDefault");
  const entry = (item: RailItem) => {
    const active = item.id === value;
    const button = (
      <button
        type="button"
        aria-current={active ? "page" : undefined}
        aria-label={
          layout !== "icons"
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
          {active && layout === "stacked" && (
            <motion.span layoutId={pill} className={styles.pill} transition={slide} />
          )}
          <Icon name={item.icon} filled={active} className={styles.railIcon} />
          {!!item.badge && (
            <span className={styles.badge} aria-hidden="true">
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
        </span>
        {layout !== "icons" && <span className={styles.label}>{item.label}</span>}
        {!!item.badge && <span className="pw-visually-hidden">, {item.badge} items</span>}
      </button>
    );
    return (
      <li key={item.id}>
        {layout !== "icons" ? (
          button
        ) : (
          <Tooltip text={item.label} placement="right" describes={false}>
            {button}
          </Tooltip>
        )}
      </li>
    );
  };
  return (
    <nav
      aria-label={label}
      className={cx(
        styles.rail,
        styles[layout],
        material === "tonal" ? styles.tonal : styles.glassRail,
        surfaceClass({ material }),
      )}
    >
      {header && <div className={styles.header}>{header}</div>}
      <ul className={styles.items}>{items.map(entry)}</ul>
      {footerItems.length > 0 && (
        <ul className={cx(styles.items, styles.end)}>{footerItems.map(entry)}</ul>
      )}
      {footer && <div className={styles.footer}>{footer}</div>}
    </nav>
  );
}
