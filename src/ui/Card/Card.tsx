import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../cx";
import styles from "./Card.module.css";

export type CardColor = "surface" | "highest" | "primary" | "secondary" | "tertiary";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "color" | "onClick"> {
  /** surface-container (default), surface-container-highest, or a container color for hero cards. */
  color?: CardColor;
  /** "card" = 24px corners; "hero" = 28px (Continue / pinned cards). */
  shape?: "card" | "hero";
  outlined?: boolean;
  /** Makes the whole card a button (hover/pressed layer, keyboard focus). */
  onClick?: () => void;
  children: ReactNode;
}

/** Tonal card. Separation comes from surface steps, not borders (DESIGN.md). */
export function Card({
  color = "surface",
  shape = "card",
  outlined = false,
  onClick,
  className,
  children,
  ...rest
}: CardProps) {
  const classes = cx(
    styles.card,
    styles[color],
    styles[shape],
    outlined && styles.outlined,
    onClick && cx("pw-state", styles.interactive),
    className,
  );
  return onClick ? (
    <button type="button" className={classes} onClick={onClick} {...rest}>
      {children}
    </button>
  ) : (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
