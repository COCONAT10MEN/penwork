import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "../cx";
import { Icon } from "../Icon";
import styles from "./Button.module.css";

export type ButtonVariant = "filled" | "tonal" | "outlined" | "text" | "quiet";
export type ButtonSize = "small" | "compact" | "medium" | "large";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Material Symbols name shown before the label. */
  icon?: string;
  /** Solid icon, for an icon that is the button's whole meaning, such as play. */
  iconFilled?: boolean;
}

const ICON_SIZE: Record<ButtonSize, number> = { small: 20, compact: 20, medium: 22, large: 32 };

/** M3 Expressive common button. Fully round; the corners tighten while pressed. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "filled",
    size = "small",
    icon,
    iconFilled,
    className,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("pw-state", styles.button, styles[variant], styles[size], className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={ICON_SIZE[size]} filled={iconFilled} />}
      {children}
    </button>
  );
});
