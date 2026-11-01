import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "../cx";
import { Icon } from "../Icon";
import { Tooltip, type TooltipPlacement } from "../Tooltip/Tooltip";
import styles from "./IconButton.module.css";

export type IconButtonVariant = "standard" | "filled" | "tonal" | "outlined" | "tool";

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> {
  icon: string;
  /** Required: icon-only buttons need a name for screen readers. Also shown as the tooltip. */
  label: string;
  variant?: IconButtonVariant;
  size?: "small" | "compact" | "medium";
  /**
   * Makes it a toggle (aria-pressed). Toggles are rounded squares when off and ease to
   * circles when on, like toolbar tools (DESIGN.md).
   */
  selected?: boolean;
  /** Icon to show while selected (defaults to the filled version of `icon`). */
  selectedIcon?: string;
  tooltip?: boolean;
  tooltipPlacement?: TooltipPlacement;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    label,
    variant = "standard",
    size = "small",
    selected,
    selectedIcon,
    tooltip = true,
    tooltipPlacement,
    className,
    type = "button",
    ...rest
  },
  ref,
) {
  const toggle = selected !== undefined;
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={toggle ? selected : undefined}
      data-selected={selected || undefined}
      className={cx(
        "pw-state pw-press",
        styles.button,
        styles[variant],
        styles[size],
        toggle && styles.toggle,
        className,
      )}
      {...rest}
    >
      <Icon
        name={selected && selectedIcon ? selectedIcon : icon}
        filled={selected === true}
        size={size === "medium" ? 28 : 24}
      />
    </button>
  );
  return tooltip ? (
    <Tooltip text={label} placement={tooltipPlacement} describes={false}>
      {button}
    </Tooltip>
  ) : (
    button
  );
});
