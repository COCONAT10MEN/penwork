import { useEffect } from "react";

interface Arrival {
  arrive?: () => void;
}

/**
 * The annotation tools are drawn by the reader page under the bar, and the bar keeps a seat for them
 * at the start of its tools. Whenever anything in the bar moves (the tools arriving, the window
 * resizing, the name changing), the seat is made as wide as they are and the tools are put where
 * the seat is, in the same frame, so the two never part.
 */
export function useDockSeat(
  frame: HTMLIFrameElement | null,
  slot: HTMLElement | null,
  /** The bar's tools are on screen, seat and all. */
  shown: boolean,
) {
  useEffect(() => {
    const doc = frame?.contentDocument;
    const seat = slot?.querySelector<HTMLElement>("[data-dock-seat]");
    if (!doc || !slot || !seat) return;
    let frameId = 0;
    let still = 0;
    let last = "";
    const step = () => {
      const tools = doc.getElementById("main");
      const width =
        tools && !tools.classList.contains("gone") ? tools.getBoundingClientRect().width : 0;
      seat.style.width = `${width}px`;
      const left = seat.getBoundingClientRect().left;
      doc.documentElement.style.setProperty("--pw-dock-left", `${left}px`);
      const now = `${width.toFixed(1)} ${left.toFixed(1)}`;
      still = now === last ? still + 1 : 0;
      last = now;
      // Until nothing has moved for a while: long enough to span the pause before the bar's tools
      // rise in, which moves them too.
      frameId = still < 40 ? requestAnimationFrame(step) : 0;
    };
    const follow = () => {
      still = 0;
      if (!frameId) frameId = requestAnimationFrame(step);
    };
    follow();
    // The bar's own tools are rising in now: the annotation tools lead the same wave.
    (frame?.contentWindow as (Window & { __pwDoc?: Arrival }) | null)?.__pwDoc?.arrive?.();
    const watcher = new ResizeObserver(follow);
    watcher.observe(slot);
    // The tools' row changing width (the page number gaining a digit) moves the seat too.
    const row = slot.querySelector("[role=group]");
    if (row) watcher.observe(row);
    // Reading tools stepping aside or back in a narrow window move it without resizing the bar.
    // Only those: every frame of following measures the PDF's page, which is too costly to do
    // for each colour change while scrolling (a page arrow turning on or off).
    const moved = (e: TransitionEvent) => {
      if (/width|margin/.test(e.propertyName)) follow();
    };
    slot.addEventListener("transitionrun", moved);
    // A tool shown or hidden in the toolbar's settings changes its width.
    const changes = new ResizeObserver(follow);
    const tools = doc.getElementById("main");
    if (tools) changes.observe(tools);
    return () => {
      cancelAnimationFrame(frameId);
      watcher.disconnect();
      changes.disconnect();
      slot.removeEventListener("transitionrun", moved);
    };
  }, [frame, slot, shown]);
}
