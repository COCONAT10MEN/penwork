import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "../cx";
import { Icon } from "../Icon";
import { Tooltip } from "../Tooltip/Tooltip";
import styles from "./Fab.module.css";

export type FabColor = "primary" | "secondary" | "tertiary";
export type FabSize = "default" | "medium" | "large";

export interface FabProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  icon: string;
  /** Accessible name. Shown as text when `extended`, otherwise as a tooltip. */
  label: string;
  extended?: boolean;
  color?: FabColor;
  size?: FabSize;
}

const ICON_SIZE: Record<FabSize, number> = { default: 24, medium: 28, large: 36 };

/** M3 Expressive FAB (56 / 80 / 96). Extended FABs show their label next to the icon. */
export const Fab = forwardRef<HTMLButtonElement, FabProps>(function Fab(
  {
    icon,
    label,
    extended = false,
    color = "primary",
    size = "default",
    className,
    type = "button",
    ...rest
  },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={extended ? undefined : label}
      className={cx(
        "pw-state pw-press",
        styles.fab,
        styles[color],
        styles[size],
        extended && styles.extended,
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={ICON_SIZE[size]} />
      {extended && <span>{label}</span>}
    </button>
  );
  return extended ? (
    button
  ) : (
    <Tooltip text={label} describes={false}>
      {button}
    </Tooltip>
  );
});
