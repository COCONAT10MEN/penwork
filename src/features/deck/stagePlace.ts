/**
 * Where the slide page sits. Its frame is always the size of the whole screen and is only ever
 * scaled and moved, in the edit view too. Resizing a page redoes its layout and draws it again,
 * which is what made going full screen choppy; moving it costs nothing.
 */
export interface Place {
  x: number;
  y: number;
  scale: number;
  /** Cropped to the 16:9 slide, in the frame's own pixels. */
  clip: string;
}

export function frameSize() {
  return { width: window.screen.width, height: window.screen.height };
}

/** The 16:9 slide inside the frame, as the slide page centres it. */
function slideBox() {
  const { width, height } = frameSize();
  const w = Math.min(width, (height * 16) / 9);
  const h = (w * 9) / 16;
  return { w, h, left: (width - w) / 2, top: (height - h) / 2 };
}

/** The frame placed so its slide fills the rectangle, with rounded corners. */
export function slotPlace(slot: DOMRect, corner: number): Place {
  const box = slideBox();
  const scale = slot.width / box.w;
  const { width, height } = frameSize();
  const right = width - box.left - box.w;
  const bottom = height - box.top - box.h;
  return {
    x: slot.left - box.left * scale,
    y: slot.top - box.top * scale,
    scale,
    clip: `inset(${box.top}px ${right}px ${bottom}px ${box.left}px round ${corner / scale}px)`,
  };
}

/** As large as the window lets it be, centred. */
export function windowPlace(): Place {
  const { width, height } = frameSize();
  const scale = Math.min(window.innerWidth / width, window.innerHeight / height);
  return {
    x: (window.innerWidth - width * scale) / 2,
    y: (window.innerHeight - height * scale) / 2,
    scale,
    clip: "inset(0px 0px 0px 0px round 0px)",
  };
}

const keyframe = ({ x, y, scale, clip }: Place): Keyframe => ({
  transform: `translate(${x}px, ${y}px) scale(${scale})`,
  clipPath: clip,
});

export function setPlace(frame: HTMLElement, place: Place): void {
  const { transform, clipPath } = keyframe(place) as { transform: string; clipPath: string };
  frame.style.transform = transform;
  frame.style.clipPath = clipPath;
}

/** Where this page's top left corner is on the screen. */
export function pageOrigin() {
  const border = (window.outerWidth - window.innerWidth) / 2;
  return {
    x: window.screenX + border,
    y: window.screenY + window.outerHeight - window.innerHeight - border,
  };
}

/** The same spot on the screen, after the page itself has moved. */
export function shifted(place: Place, from: { x: number; y: number }): Place {
  const to = pageOrigin();
  return { ...place, x: place.x + from.x - to.x, y: place.y + from.y - to.y };
}

/** Everything still moving the frame stops where it is. */
export function stopMoving(frame: HTMLElement): void {
  for (const animation of frame.getAnimations())
    if (animation.id === "pw-place") animation.cancel();
}

/**
 * Moves the frame on one of the app's springs. Null when motion is reduced. The crop runs apart
 * from the movement: one animation with both would be held on the main thread, and this way the
 * graphics card moves the slide even when the app is busy.
 */
export function glide(
  frame: HTMLElement,
  from: Place,
  to: Place,
  spring: "spatial-default" | "effects-default",
): Animation | null {
  setPlace(frame, to);
  const css = getComputedStyle(document.documentElement);
  const duration = parseFloat(css.getPropertyValue(`--md-sys-motion-${spring}-duration`));
  if (!duration) return null;
  const timing = {
    id: "pw-place",
    duration,
    easing: css.getPropertyValue(`--md-sys-motion-${spring}-easing`),
  };
  const [start, end] = [keyframe(from), keyframe(to)];
  frame.animate([{ clipPath: start.clipPath }, { clipPath: end.clipPath }], timing);
  return frame.animate([{ transform: start.transform }, { transform: end.transform }], timing);
}
