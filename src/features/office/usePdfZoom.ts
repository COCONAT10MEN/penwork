import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { clampScale, fitScale, wheelZoom, type Fit } from "../../lib/pdfZoom";
import { setScale } from "./pdfViewerSet";

/** How long pdf.js waits after the last zoom step before drawing pages sharp again. */
const REDRAW_MS = 300;

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

  const applyFit = useCallback(
    (mode: Fit) => {
      if (!parts || !box || !pageSize) return;
      const room = { width: box.clientWidth, height: box.clientHeight - 20 };
      setScale(parts.viewer, fitScale(mode, room, pageSize, { across: start.across, gap: 10 }));
    },
    [parts, box, pageSize, start.across],
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
      if (e.key === "=" || e.key === "+") zoomAt({ steps: 1 });
      else if (e.key === "-") zoomAt({ steps: -1 });
      else if (e.key === "0") {
        setFit("width");
        applyFit("width");
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [parts, zoomAt, applyFit]);

  const chooseFit = (mode: Fit) => {
    setFit(mode);
    applyFit(mode);
  };
  const chooseScale = (value: number) => {
    setFit(null);
    if (parts) setScale(parts.viewer, clampScale(value));
  };

  return { fit, scale, chooseFit, chooseScale, zoomAt };
}
