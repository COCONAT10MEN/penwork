import { useState, type Ref } from "react";
import { cx } from "../cx";
import { Icon } from "../Icon";
import { Menu, type MenuEntry } from "../Menu/Menu";
import type { SurfaceMaterial } from "../Surface/Surface";
import styles from "./SplitButton.module.css";

export interface SplitButtonProps {
  label: string;
  icon?: string;
  onClick: () => void;
  /** Name of the arrow button, e.g. "More save options". */
  menuLabel: string;
  items: MenuEntry[];
  variant?: "filled" | "tonal";
  size?: "small" | "compact";
  iconFilled?: boolean;
  /** For screen readers, when the main action needs more than its label. */
  mainLabel?: string;
  mainRef?: Ref<HTMLButtonElement>;
  menuMaterial?: SurfaceMaterial;
}

/** M3 Expressive split button: a main action, plus an arrow that opens related actions. */
export function SplitButton({
  label,
  icon,
  onClick,
  menuLabel,
  items,
  variant = "filled",
  size = "small",
  iconFilled,
  mainLabel,
  mainRef,
  menuMaterial,
}: SplitButtonProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <div
      role="group"
      aria-label={label}
      data-press-group
      className={cx(styles.group, styles[variant], styles[size])}
    >
      <button
        ref={mainRef}
        type="button"
        aria-label={mainLabel}
        className={cx("pw-state pw-press", styles.main)}
        onClick={onClick}
      >
        {icon && <Icon name={icon} size={20} filled={iconFilled} />}
        {label}
      </button>
      <button
        ref={setAnchor}
        type="button"
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        data-open={open || undefined}
        className={cx("pw-state pw-press", styles.arrow)}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="keyboard_arrow_down" size={20} className={styles.chevron} />
      </button>
      <Menu
        open={open}
        anchor={anchor}
        label={menuLabel}
        items={items}
        material={menuMaterial}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
