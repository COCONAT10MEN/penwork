import type { CSSProperties } from "react";
import { cx } from "./cx";

export interface IconProps {
  /** Material Symbols name, e.g. "search" (https://fonts.google.com/icons). */
  name: string;
  /** Filled glyph; DESIGN.md uses it for selected states. */
  filled?: boolean;
  size?: number;
  className?: string;
}

/** Decorative icon. The control around it carries the accessible label. */
export function Icon({ name, filled = false, size = 24, className }: IconProps) {
  const style = {
    fontSize: size,
    "--pw-icon-fill": filled ? 1 : 0,
    // The font's optical size axis covers 20–48.
    "--pw-icon-opsz": Math.min(48, Math.max(20, size)),
  } as CSSProperties;
  return (
    <span className={cx("material-symbols-rounded", className)} style={style} aria-hidden="true">
      {name}
    </span>
  );
}
