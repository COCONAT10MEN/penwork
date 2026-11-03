/** PDF zoom maths, kept apart from the screen so it can be tested. */

/** pdf.js: a page at scale 1 is its size in points shown as CSS pixels (96 / 72). */
export const POINTS_TO_PX = 96 / 72;
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;

export type Fit = "width" | "page";

/** The scale that makes the page fill the box: its width, or the whole page. */
export function fitScale(
  fit: Fit,
  box: { width: number; height: number },
  page: { width: number; height: number },
  { across = 1, gap = 0 } = {},
): number {
  const width = (box.width - gap * (across - 1)) / across / (page.width * POINTS_TO_PX);
  if (fit === "width") return clampScale(width);
  const height = box.height / (page.height * POINTS_TO_PX);
  return clampScale(Math.min(width, height));
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * A touchpad pinch arrives as Ctrl + wheel with small, uneven steps. A mouse wheel with Ctrl held
 * comes in whole notches of about 100, which would be far too big a jump taken as a pinch.
 */
export function wheelZoom(deltaY: number, deltaMode: number): { factor: number } | { steps: number } {
  const lines = deltaMode === 1;
  const notch = lines || (Math.abs(deltaY) >= 50 && Number.isInteger(deltaY));
  if (notch) return { steps: deltaY < 0 ? 1 : -1 };
  return { factor: Math.exp(-deltaY / 100) };
}

/** Percent for the zoom button, as a person would say it. */
export function zoomLabel(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}
