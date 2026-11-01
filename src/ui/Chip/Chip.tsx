import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "../cx";
import { Icon } from "../Icon";
import styles from "./Chip.module.css";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  label: string;
  /** "filter" toggles (aria-pressed) and shows a check when selected; "assist" is an action. */
  variant?: "filter" | "assist";
  icon?: string;
  selected?: boolean;
}

/** M3 chip, 8px corners. Filter chips swap their icon for a check mark when selected. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { label, variant = "assist", icon, selected = false, className, type = "button", ...rest },
  ref,
) {
  const filter = variant === "filter";
  const leading = filter && selected ? "check" : icon;
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={filter ? selected : undefined}
      data-selected={(filter && selected) || undefined}
      className={cx(
        "pw-state pw-press",
        styles.chip,
        styles[variant],
        !leading && styles.noIcon,
        className,
      )}
      {...rest}
    >
      {leading && <Icon name={leading} size={18} className={styles.icon} />}
      {label}
    </button>
  );
});
