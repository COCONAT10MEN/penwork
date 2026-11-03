import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { clampScale, fitScale, wheelZoom, type Fit } from "../../lib/pdfZoom";
import { flipViewer, playFrom } from "./flipViewer";
import { setScale } from "./pdfViewerSet";

/** How long pdf.js waits after the last zoom step before drawing pages sharp again. */
const REDRAW_MS = 300;
/** After a glide: past its end, so pages are redrawn once, at rest. */
const GLIDE_REDRAW_MS = 650;

interface Parts {
  viewer: PDFViewer;
  document: PDFDocumentProxy;
}

/**
 * Every way to zoom: two fingers on a touchpad or touch screen, Ctrl + wheel, the keyboard and the
 * buttons. While zooming the pages are stretched as they are and redrawn sharp once it stops,
 * which is what keeps a pinch smooth.
 */
export function usePdfZoom(
  box: HTMLDivElement | null,
  parts: Parts | null,
  start: { fit: Fit | null; scale: number; across: number },
) {
  const [fit, setFit] = useState<Fit | null>(start.fit);
  const [scale, setShown] = useState(1);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const fitNow = useRef(fit);
  useEffect(() => {
    fitNow.current = fit;
  });

  /** Changes the zoom by stretching the pages now and redrawing them later, and glides there. */
  const glideTo = useCallback(
    (target: number, glide: boolean) => {
      if (!parts || !box) return;
      const { viewer } = parts;
      const factor = clampScale(target) / viewer.currentScale;
      if (Math.abs(factor - 1) < 0.001) return;
      const change = () =>
        viewer.updateScale({ drawingDelay: GLIDE_REDRAW_MS, scaleFactor: factor });
      if (glide) flipViewer(box, viewer.currentPageNumber, change);
      else change();
    },
    [parts, box],
  );

  const applyFit = useCallback(
    /** now: draw at once. glide: animate there. stretch: stretch now and draw sharp later. */
    (mode: Fit, how: "now" | "glide" | "stretch" = "now") => {
      if (!parts || !box || !pageSize) return;
      const room = { width: box.clientWidth, height: box.clientHeight - 20 };
      const target = fitScale(mode, room, pageSize, { across: start.across, gap: 10 });
      if (how === "now") setScale(parts.viewer, target);
      else glideTo(target, how === "glide");
    },
    [parts, box, pageSize, start.across, glideTo],
  );

  // The first page's size sets every fit, as it does in other readers.
  useEffect(() => {
    if (!parts) return;
    let cancelled = false;
    void parts.document.getPage(1).then((page) => {
      if (cancelled) return;
      const { width, height } = page.getViewport({ scale: 1 });
      setPageSize({ width, height });
    });
    const onScale = (e: { scale: number }) => setShown(e.scale);
    parts.viewer.eventBus.on("scalechanging", onScale);
    return () => {
      cancelled = true;
      parts.viewer.eventBus.off("scalechanging", onScale);
    };
  }, [parts]);

  // Once the page size is known: the starting fit, or the starting zoom.
  useEffect(() => {
    if (!parts || !pageSize) return;
    if (fitNow.current) applyFit(fitNow.current);
    else setScale(parts.viewer, clampScale(start.scale));
  }, [parts, pageSize, applyFit, start.scale]);

  // A fitted page keeps fitting as the window or side panel changes size.
  useEffect(() => {
    if (!box || !parts) return;
    let frame = 0;
    const watcher = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (fitNow.current) applyFit(fitNow.current);
      });
    });
    watcher.observe(box);
    return () => {
      cancelAnimationFrame(frame);
      watcher.disconnect();
    };
  }, [box, parts, applyFit]);

  const zoomAt = useCallback(
    (change: { factor: number } | { steps: number }, origin?: [number, number]) => {
      if (!parts) return;
      setFit(null);
      parts.viewer.updateScale({
        drawingDelay: REDRAW_MS,
        ...("factor" in change ? { scaleFactor: change.factor } : { steps: change.steps }),
        origin,
      });
    },
    [parts],
  );

  /** The buttons and keys: one step, gliding. A pinch follows the fingers instead. */
  const step = useCallback(
    (steps: number) => {
      if (!parts) return;
      setFit(null);
      const now = parts.viewer.currentScale;
      // pdf.js's own steps of 10%, rounded as it rounds them.
      let next = now;
      for (let i = 0; i < Math.abs(steps); i++) {
        next = steps > 0 ? Math.ceil(next * 1.1 * 10) / 10 : Math.floor((next / 1.1) * 10) / 10;
      }
      glideTo(next, true);
    },
    [parts, glideTo],
  );

  // Ctrl + wheel is what Windows sends for a touchpad pinch. It has to be caught before the page
  // scrolls, so the listener can't be passive.
  useEffect(() => {
    if (!box || !parts) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomAt(wheelZoom(e.deltaY, e.deltaMode), [e.clientX, e.clientY]);
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [box, parts, zoomAt]);

  // Two fingers on a touch screen.
  useEffect(() => {
    if (!box || !parts) return;
    const touches = new Map<number, [number, number]>();
    let last = 0;
    const spread = () => {
      const [a, b] = [...touches.values()];
      return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0;
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      last = spread();
    };
    const move = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      const now = spread();
      if (touches.size !== 2 || last === 0 || now === 0) return;
      const [a, b] = [...touches.values()] as [[number, number], [number, number]];
      zoomAt({ factor: now / last }, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      last = now;
    };
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      last = spread();
    };
    box.addEventListener("pointerdown", down);
    box.addEventListener("pointermove", move);
    box.addEventListener("pointerup", up);
    box.addEventListener("pointercancel", up);
    return () => {
      box.removeEventListener("pointerdown", down);
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerup", up);
      box.removeEventListener("pointercancel", up);
    };
  }, [box, parts, zoomAt]);

  // Ctrl + plus and minus, and Ctrl + 0 to fit the width again.
  useEffect(() => {
    if (!parts) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey) return;
      if (e.key === "=" || e.key === "+") step(1);
      else if (e.key === "-") step(-1);
      else if (e.key === "0") {
        setFit("width");
        applyFit("width", "glide");
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [parts, step, applyFit]);

  const chooseFit = (mode: Fit) => {
    setFit(mode);
    applyFit(mode, "glide");
  };
  const chooseScale = (value: number) => {
    setFit(null);
    glideTo(value, true);
  };

  /** The fit again after the space changed, gliding from `before`. For the side panel. */
  const refit = (before: DOMRect | null) => {
    if (!box || !parts) return;
    const page = parts.viewer.currentPageNumber;
    // Stretched for now: drawing every page again during the slide is what made it stutter.
    if (fitNow.current) applyFit(fitNow.current, "stretch");
    playFrom(box, page, before, "effects-slow");
  };

  return { fit, scale, chooseFit, chooseScale, zoomAt, step, refit };
}
