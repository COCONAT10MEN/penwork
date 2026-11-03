import { useEffect, useRef, useState } from "react";

/** Scrolled this far in one direction before the bar moves, so a little jitter doesn't flick it. */
const NUDGE = 12;
/** Near the top of the file, or with the pointer at the top edge, the bar always shows. */
const TOP = 64;
const EDGE = 12;

/** With the setting on, the bar slides away while reading down and comes back on the way up. */
export function useBarHiding(
  box: HTMLElement | null,
  enabled: boolean,
  onChange: ((hidden: boolean) => void) | undefined,
): boolean {
  const [hidden, setHidden] = useState(false);
  const report = useRef(onChange);
  useEffect(() => {
    report.current = onChange;
  });

  useEffect(() => {
    report.current?.(enabled && hidden);
  }, [enabled, hidden]);

  useEffect(() => {
    if (!box || !enabled) return;
    let last = box.scrollTop;
    let travel = 0;
    const onScroll = () => {
      const top = box.scrollTop;
      const step = top - last;
      last = top;
      if (top < TOP) {
        travel = 0;
        setHidden(false);
        return;
      }
      travel = Math.sign(step) === Math.sign(travel) ? travel + step : step;
      if (travel > NUDGE) setHidden(true);
      else if (travel < -NUDGE) setHidden(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (e.clientY < EDGE) setHidden(false);
    };
    // The PDF is in a page of its own, so its pointer is watched there as well as here.
    const inner = box.ownerDocument.defaultView;
    box.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    inner?.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      box.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      inner?.removeEventListener("pointermove", onPointer);
    };
  }, [box, enabled]);

  return enabled && hidden;
}
