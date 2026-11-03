import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useEffect, useReducer, useRef, useState } from "react";
import { Button, Surface } from "../../ui";
import type { PlacedArea, PlaceSpec } from "./types";
import styles from "./PdfTools.module.css";

/**
 * Marking places on the pages: drag a box (or click for a ready-sized one). Boxes are kept in the
 * page's own coordinates and drawn where the page is now, so scrolling and zooming carry them.
 */

interface PageHit {
  n: number;
  rect: DOMRect;
}

function pageAt(doc: Document, x: number, y: number): PageHit | null {
  for (const el of doc.querySelectorAll<HTMLElement>(".page[data-page-number]")) {
    const rect = el.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
      return { n: Number(el.dataset.pageNumber), rect };
  }
  return null;
}

function pageRect(doc: Document, n: number): DOMRect | null {
  return (
    doc.querySelector<HTMLElement>(`.page[data-page-number="${n}"]`)?.getBoundingClientRect() ??
    null
  );
}

export function PlaceLayer({
  frame,
  viewer,
  spec,
  onDone,
}: {
  frame: HTMLIFrameElement;
  viewer: PDFViewer;
  spec: PlaceSpec;
  onDone: (areas: PlacedArea[] | null) => void;
}) {
  const doc = frame.contentDocument;
  const [areas, setAreas] = useState<PlacedArea[]>([]);
  const [drag, setDrag] = useState<{
    n: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);
  const [typing, setTyping] = useState<number | null>(null);
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const finished = useRef(false);

  // The boxes follow the pages.
  useEffect(() => {
    const scroller = doc?.getElementById("scroller");
    scroller?.addEventListener("scroll", redraw, { passive: true });
    viewer.eventBus.on("scalechanging", redraw);
    return () => {
      scroller?.removeEventListener("scroll", redraw);
      viewer.eventBus.off("scalechanging", redraw);
    };
  }, [doc, viewer]);

  const finish = (result: PlacedArea[] | null) => {
    if (finished.current) return;
    finished.current = true;
    onDone(result);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && typing === null) finish(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!doc) return null;

  /** A box on screen, as an area in the page's own coordinates. */
  const toArea = (
    n: number,
    a: { x0: number; y0: number; x1: number; y1: number },
  ): PlacedArea | null => {
    const rect = pageRect(doc, n);
    const view = viewer.getPageView(n - 1)?.viewport;
    if (!rect || !view) return null;
    const [px0, py0] = view.convertToPdfPoint(
      Math.min(a.x0, a.x1) - rect.left,
      Math.min(a.y0, a.y1) - rect.top,
    );
    const [px1, py1] = view.convertToPdfPoint(
      Math.max(a.x0, a.x1) - rect.left,
      Math.max(a.y0, a.y1) - rect.top,
    );
    return {
      page: n,
      x: Math.min(px0, px1),
      y: Math.min(py0, py1),
      width: Math.abs(px1 - px0),
      height: Math.abs(py1 - py0),
    };
  };

  const onScreen = (a: PlacedArea) => {
    const rect = pageRect(doc, a.page);
    const view = viewer.getPageView(a.page - 1)?.viewport;
    if (!rect || !view) return null;
    // pdf.js 6 has no rectangle conversion; two corners do the same.
    const [x0, y0] = view.convertToViewportPoint(a.x, a.y) as [number, number];
    const [x1, y1] = view.convertToViewportPoint(a.x + a.width, a.y + a.height) as [number, number];
    return {
      left: rect.left + Math.min(x0, x1),
      top: rect.top + Math.min(y0, y1),
      width: Math.abs(x1 - x0),
      height: Math.abs(y1 - y0),
      scale: view.scale,
    };
  };

  /** Clamped to the page, and to the picture's shape if it has one. */
  const shaped = (d: NonNullable<typeof drag>) => {
    const rect = pageRect(doc, d.n);
    if (!rect) return d;
    let { x1, y1 } = d;
    x1 = Math.max(rect.left, Math.min(rect.right, x1));
    y1 = Math.max(rect.top, Math.min(rect.bottom, y1));
    if (spec.aspect) {
      const w = Math.abs(x1 - d.x0);
      y1 = d.y0 + Math.sign(y1 - d.y0 || 1) * (w / spec.aspect);
    }
    return { ...d, x1, y1 };
  };

  const place = (d: NonNullable<typeof drag>) => {
    let box = shaped(d);
    const tiny = Math.abs(box.x1 - box.x0) < 8 || Math.abs(box.y1 - box.y0) < 8;
    if (tiny) {
      if (spec.look === "dark") return;
      // A click: a box of a useful size, starting there.
      const scale = viewer.currentScale;
      const w = (spec.typing ? 220 : spec.aspect ? 160 : 120) * scale;
      const h = spec.aspect
        ? w / spec.aspect
        : spec.typing
          ? spec.typing.size * 1.6 * scale
          : 80 * scale;
      box = shaped({ ...box, x1: box.x0 + w, y1: box.y0 + h });
    }
    const area = toArea(d.n, box);
    if (!area) return;
    if (!spec.multiple && !spec.typing) return finish([area]);
    setAreas((all) => [...all, area]);
    if (spec.typing) setTyping(areas.length);
  };

  const draft = drag ? shaped(drag) : null;

  return (
    <div
      className={styles.placeLayer}
      onWheel={(e) => doc.getElementById("scroller")?.scrollBy({ left: e.deltaX, top: e.deltaY })}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget || e.button !== 0) return;
        const hit = pageAt(doc, e.clientX, e.clientY);
        if (!hit) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ n: hit.n, x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY });
      }}
      onPointerMove={(e) => drag && setDrag({ ...drag, x1: e.clientX, y1: e.clientY })}
      onPointerUp={() => {
        if (drag) place(drag);
        setDrag(null);
      }}
    >
      {areas.map((a, i) => {
        const s = onScreen(a);
        if (!s) return null;
        return (
          <div
            key={i}
            className={styles.placed}
            data-look={spec.look}
            style={{ left: s.left, top: s.top, width: s.width, height: s.height }}
          >
            {spec.look === "picture" && spec.picture && <img src={spec.picture} alt="" />}
            {spec.typing &&
              (typing === i ? (
                <textarea
                  className={styles.typing}
                  autoFocus
                  aria-label="Text to add"
                  style={{ fontSize: spec.typing.size * s.scale, color: spec.typing.color }}
                  defaultValue={a.text ?? ""}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setAreas((all) => all.filter((_, j) => j !== i));
                      setTyping(null);
                    }
                  }}
                  onBlur={(e) => {
                    const text = e.currentTarget.value;
                    setAreas((all) => all.map((x, j) => (j === i ? { ...x, text } : x)));
                    setTyping(null);
                  }}
                />
              ) : (
                <span
                  className={styles.typed}
                  style={{ fontSize: spec.typing.size * s.scale, color: spec.typing.color }}
                >
                  {a.text}
                </span>
              ))}
          </div>
        );
      })}
      {draft && (
        <div
          className={styles.placed}
          data-look={spec.look}
          data-draft
          style={{
            left: Math.min(draft.x0, draft.x1),
            top: Math.min(draft.y0, draft.y1),
            width: Math.abs(draft.x1 - draft.x0),
            height: Math.abs(draft.y1 - draft.y0),
          }}
        />
      )}
      <Surface material="glass" strength="thick" floating className={styles.placeBar}>
        <span className={styles.placeHint}>{spec.hint}</span>
        {areas.length > 0 && (
          <Button
            variant="text"
            size="small"
            icon="undo"
            onClick={() => setAreas((all) => all.slice(0, -1))}
          >
            Remove last
          </Button>
        )}
        <Button variant="tonal" size="small" onClick={() => finish(null)}>
          Cancel
        </Button>
        {(spec.multiple || spec.typing) && (
          <Button size="small" disabled={!areas.length} onClick={() => finish(areas)}>
            {spec.done ?? "Done"}
          </Button>
        )}
      </Surface>
    </div>
  );
}
