import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "../cx";
import styles from "./Surface.module.css";

export type SurfaceMaterial = "glass" | "tonal";
export type SurfaceStrength = "thin" | "regular" | "thick";

export interface SurfaceStyle {
  material?: SurfaceMaterial;
  /** Glass only. Thin: short labels. Regular: dock and panels. Thick: lots of text. */
  strength?: SurfaceStrength;
  /** Floating things get a shadow. */
  floating?: boolean;
  /**
   * Glass look with no backdrop blur: an opaque fill, rim and sheen. For popovers and menus,
   * because of the WebView2 blanking bug (DESIGN-GLASS §7), and for anything that opens often.
   */
  solid?: boolean;
  /**
   * Set false for many small surfaces, like a grid of cards: the same translucent fill with no
   * backdrop blur, which keeps the screen under the ~6 blurred layers limit.
   */
  blur?: boolean;
}

/** The classes for a surface, for components that render their own element (dialog, motion.div). */
// eslint-disable-next-line react-refresh/only-export-components -- it belongs with Surface
export function surfaceClass({
  material = "glass",
  strength = "regular",
  floating = false,
  solid = false,
  blur = true,
}: SurfaceStyle = {}): string | undefined {
  if (material === "tonal") return undefined;
  return cx(
    "pw-glass",
    styles.glass,
    styles[strength],
    floating && styles.floating,
    solid && styles.solid,
    !blur && styles.noBlur,
  );
}

export interface SurfaceProps extends SurfaceStyle, HTMLAttributes<HTMLDivElement> {}

/**
 * The one place glass is built (DESIGN-GLASS §2). "The frame is glass, the jewel is solid":
 * selected and primary things inside it stay solid colors. Never nest glass in glass, the
 * inner one has nothing left to blur.
 */
export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  { material = "glass", strength, floating, solid, blur, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx(
        material === "tonal" && styles.tonal,
        surfaceClass({ material, strength, floating, solid, blur }),
        className,
      )}
      {...rest}
    />
  );
});
