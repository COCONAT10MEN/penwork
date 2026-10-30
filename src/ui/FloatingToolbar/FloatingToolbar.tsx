import type { CSSProperties, ReactNode } from "react";
import { cx } from "../cx";
import { surfaceClass, type SurfaceMaterial } from "../Surface/Surface";
import styles from "./FloatingToolbar.module.css";

export type ToolbarPosition = "tl" | "tc" | "tr" | "bl" | "bc" | "br";

export interface FloatingToolbarProps {
  /** Name of the toolbar for screen readers. */
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The logo, drawn in currentColor. */
  logo: ReactNode;
  /** Colors that swap as it opens (DESIGN-GLASS §8). Default: primary on the logo background. */
  logoColor?: string;
  logoBackground?: string;
  orientation?: "horizontal" | "vertical";
  /** Pins it to a window corner or edge. Leave out to place it yourself. */
  position?: ToolbarPosition;
  material?: SurfaceMaterial;
  children: ReactNode;
}

/**
 * The generic capsule: a round logo that grows into one body with its buttons. No seam, no
 * bounce, the frame the same thickness all round (HANDOFF §3.10). Dragging, snapping and sinking
 * into the edge belong to the dock in M5.
 */
export function FloatingToolbar({
  label,
  open,
  onOpenChange,
  logo,
  logoColor,
  logoBackground,
  orientation = "horizontal",
  position,
  material = "glass",
  children,
}: FloatingToolbarProps) {
  const colors = {
    "--pw-toolbar-logo": logoColor,
    "--pw-toolbar-logo-bg": logoBackground,
  } as CSSProperties;
  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation={orientation}
      data-open={open || undefined}
      data-orientation={orientation}
      data-position={position}
      style={colors}
      className={cx(
        styles.capsule,
        material === "tonal" && styles.tonal,
        surfaceClass({ material, floating: true }),
      )}
    >
      <button
        type="button"
        aria-label={open ? `Close ${label.toLowerCase()}` : `Open ${label.toLowerCase()}`}
        aria-expanded={open}
        className={cx("pw-state", styles.logo)}
        onClick={() => onOpenChange(!open)}
      >
        {logo}
      </button>
      <div className={styles.reveal} inert={!open}>
        <div className={styles.items}>{children}</div>
      </div>
    </div>
  );
}

/** A thin line between groups of tools. */
export function ToolbarDivider() {
  return <span role="separator" className={styles.divider} />;
}
