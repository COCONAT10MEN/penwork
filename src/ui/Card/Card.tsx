import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../cx";
import { surfaceClass, type SurfaceMaterial } from "../Surface/Surface";
import styles from "./Card.module.css";

export type CardColor = "surface" | "highest" | "primary" | "secondary" | "tertiary";

interface BaseCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "color" | "onClick"> {
  /** surface-container (default), surface-container-highest, or a container color for hero cards. */
  color?: CardColor;
  /** "card" = 24px corners; "hero" = 28px (Continue / pinned cards). */
  shape?: "card" | "hero";
  outlined?: boolean;
  /** "glass" ignores `color`: glass cards take the tint of the theme. */
  material?: SurfaceMaterial;
  children: ReactNode;
}

/**
 * A clickable card needs a short name for its main action ("Open Lecture notes"), because the
 * click target is a separate invisible button: other buttons inside the card keep working.
 */
export type CardProps = BaseCardProps &
  ({ onClick?: undefined; actionLabel?: undefined } | { onClick: () => void; actionLabel: string });

/** Tonal card. Separation comes from surface steps, not borders (DESIGN.md). */
export function Card({
  color = "surface",
  shape = "card",
  outlined = false,
  material = "tonal",
  onClick,
  actionLabel,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cx(
        styles.card,
        material === "tonal" && styles[color],
        styles[shape],
        material === "tonal" && outlined && styles.outlined,
        surfaceClass({ material }),
        onClick && cx("pw-state", styles.interactive),
        className,
      )}
      {...rest}
    >
      {onClick && (
        <button
          type="button"
          className={styles.stretched}
          aria-label={actionLabel}
          onClick={onClick}
        />
      )}
      {children}
    </div>
  );
}
