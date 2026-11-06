import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useEffect, useReducer, useState } from "react";
import { Button, Surface } from "../../ui";
import styles from "./PdfTools.module.css";

/**
 * Edit text: point at words on a page, click, change them, press Enter. Each change paints over the
 * old words in the paper's own colour and writes the new ones at the same size, in the same kind
 * of type and ink colour, so it reads as an edit. Nothing changes in the file until Done.
 */

export interface TextEdit {
  page: number;
  /** The old words' box, in the page's own coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  size: number;
  font: "sans" | "serif" | "mono";
  ink: string;
  paper: string;
}

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** The paper's colour just around the words, and the darkest-against-it colour inside them. */
function sampleColors(page: HTMLElement, box: DOMRect): { paper: string; ink: string } {
  const canvas = page.querySelector("canvas");
  const ctx = canvas?.getContext("2d", { willReadFrequently: true });
  if (!canvas || !ctx) return { paper: "#ffffff", ink: "#000000" };
  const c = canvas.getBoundingClientRect();
  const k = canvas.width / c.width;
  const read = (x: number, y: number, w: number, h: number) =>
    ctx.getImageData(
      Math.max(0, Math.round((x - c.left) * k)),
      Math.max(0, Math.round((y - c.top) * k)),
      Math.max(1, Math.round(w * k)),
      Math.max(1, Math.round(h * k)),
    ).data;
  // Above and below the words: the colour seen most is the paper, whatever else crosses the edge.
  const counts = new Map<number, number>();
  const strips = [
    read(box.left - 3, box.top - 3, box.width + 6, 2),
    read(box.left - 3, box.bottom + 1, box.width + 6, 2),
  ];
  for (const strip of strips)
    for (let i = 0; i < strip.length; i += 4) {
      const key =
        (((strip[i] ?? 0) >> 3) << 10) |
        (((strip[i + 1] ?? 0) >> 3) << 5) |
        ((strip[i + 2] ?? 0) >> 3);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  const common = [...counts].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 0x7fff;
  // Back from 5 bits a channel to 8 (31 × 8.226 ≈ 255).
  const paper = [
    ((common >> 10) & 31) * 8.226,
    ((common >> 5) & 31) * 8.226,
    (common & 31) * 8.226,
  ] as const;
  const inside = read(box.left, box.top, box.width, box.height);
  let best = 0;
  let ink: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < inside.length; i += 4) {
    const px: [number, number, number] = [inside[i] ?? 0, inside[i + 1] ?? 0, inside[i + 2] ?? 0];
    const d = Math.abs(px[0] - paper[0]) + Math.abs(px[1] - paper[1]) + Math.abs(px[2] - paper[2]);
    if (d > best) {
      best = d;
      ink = px;
    }
  }
  return { paper: hex(...paper), ink: hex(...ink) };
}

export function EditTextLayer({
  frame,
  viewer,
  onDone,
}: {
  frame: HTMLIFrameElement;
  viewer: PDFViewer;
  onDone: (edits: TextEdit[] | null) => void;
}) {
  const doc = frame.contentDocument;
  const [hover, setHover] = useState<DOMRect | null>(null);
  const [editing, setEditing] = useState<{
    span: HTMLElement;
    page: HTMLElement;
    box: DOMRect;
    text: string;
  } | null>(null);
  const [edits, setEdits] = useState<TextEdit[]>([]);
  const [, redraw] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const scroller = doc?.getElementById("scroller");
    scroller?.addEventListener("scroll", redraw, { passive: true });
    return () => scroller?.removeEventListener("scroll", redraw);
  }, [doc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editing) onDone(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!doc) return null;

  const spanAt = (x: number, y: number) => {
    const el = doc
      .elementsFromPoint(x, y)
      .find((e) => e.closest(".textLayer") && e.tagName === "SPAN" && e.textContent?.trim());
    const page = el?.closest<HTMLElement>(".page[data-page-number]");
    return el && page ? { span: el as HTMLElement, page } : null;
  };

  /** A page's box on screen, as the page's own coordinates. */
  const toPage = (page: HTMLElement, box: DOMRect) => {
    const n = Number(page.dataset.pageNumber);
    const view = viewer.getPageView(n - 1)?.viewport;
    const p = page.getBoundingClientRect();
    if (!view) return null;
    const [ax, ay] = view.convertToPdfPoint(box.left - p.left, box.bottom - p.top) as [
      number,
      number,
    ];
    const [bx, by] = view.convertToPdfPoint(box.right - p.left, box.top - p.top) as [
      number,
      number,
    ];
    return {
      n,
      view,
      x: Math.min(ax, bx),
      y: Math.min(ay, by),
      width: Math.abs(bx - ax),
      height: Math.abs(by - ay),
    };
  };

  const commit = (text: string) => {
    if (!editing) return;
    const { span, page, box } = editing;
    setEditing(null);
    if (text === editing.text) return;
    const at = toPage(page, box);
    if (!at) return;
    const family = getComputedStyle(span).fontFamily.toLowerCase();
    const font = /mono|courier/.test(family)
      ? "mono"
      : /serif/.test(family) && !/sans/.test(family)
        ? "serif"
        : "sans";
    const colors = sampleColors(page, box);
    setEdits((all) => [
      ...all,
      {
        page: at.n,
        x: at.x,
        y: at.y,
        width: at.width,
        height: at.height,
        text,
        size: box.height / at.view.scale,
        font,
        ...colors,
      },
    ]);
  };

  const onScreen = (e: TextEdit) => {
    const page = doc.querySelector<HTMLElement>(`.page[data-page-number="${e.page}"]`);
    const view = viewer.getPageView(e.page - 1)?.viewport;
    if (!page || !view) return null;
    const p = page.getBoundingClientRect();
    const [ax, ay] = view.convertToViewportPoint(e.x, e.y) as [number, number];
    const [bx, by] = view.convertToViewportPoint(e.x + e.width, e.y + e.height) as [number, number];
    return {
      left: p.left + Math.min(ax, bx),
      top: p.top + Math.min(ay, by),
      width: Math.abs(bx - ax),
      height: Math.abs(by - ay),
      scale: view.scale,
    };
  };

  return (
    <div
      className={styles.placeLayer}
      style={{ cursor: hover ? "text" : "default" }}
      onWheel={(e) => doc.getElementById("scroller")?.scrollBy({ left: e.deltaX, top: e.deltaY })}
      onPointerMove={(e) =>
        setHover(spanAt(e.clientX, e.clientY)?.span.getBoundingClientRect() ?? null)
      }
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return;
        const hit = spanAt(e.clientX, e.clientY);
        if (!hit) return;
        e.preventDefault();
        setEditing({
          ...hit,
          box: hit.span.getBoundingClientRect(),
          text: hit.span.textContent ?? "",
        });
      }}
    >
      {hover && !editing && (
        <div
          className={styles.editHover}
          style={{
            left: hover.left - 2,
            top: hover.top - 2,
            width: hover.width + 4,
            height: hover.height + 4,
          }}
        />
      )}
      {edits.map((e, i) => {
        const s = onScreen(e);
        return s ? (
          <div
            key={i}
            className={styles.editBox}
            style={{
              left: s.left,
              top: s.top,
              width: s.width,
              height: s.height,
              background: e.paper,
              color: e.ink,
              fontSize: e.size * s.scale,
              fontFamily:
                e.font === "serif"
                  ? "Times New Roman, serif"
                  : e.font === "mono"
                    ? "Courier New, monospace"
                    : "Helvetica, Arial, sans-serif",
            }}
          >
            {e.text}
          </div>
        ) : null;
      })}
      {editing && (
        <input
          className={styles.editInput}
          aria-label="New text"
          autoFocus
          defaultValue={editing.text}
          style={{
            left: editing.box.left - 2,
            top: editing.box.top - 2,
            width: Math.max(80, editing.box.width + 40),
            height: editing.box.height + 4,
            fontSize: editing.box.height,
          }}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(e.currentTarget.value);
            if (e.key === "Escape") {
              e.stopPropagation();
              setEditing(null);
            }
          }}
          onBlur={(e) => commit(e.currentTarget.value)}
        />
      )}
      <Surface material="glass" strength="thick" floating className={styles.placeBar}>
        <span className={styles.placeHint}>
          {edits.length
            ? `${edits.length} ${edits.length === 1 ? "change" : "changes"}. Click more words, or Done.`
            : "Click words to change them. Enter keeps a change."}
        </span>
        {edits.length > 0 && (
          <Button
            variant="text"
            size="small"
            icon="undo"
            onClick={() => setEdits((all) => all.slice(0, -1))}
          >
            Undo last
          </Button>
        )}
        <Button variant="tonal" size="small" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button size="small" disabled={!edits.length} onClick={() => onDone(edits)}>
          Done
        </Button>
      </Surface>
    </div>
  );
}
