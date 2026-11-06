import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useEffect, useReducer, useState } from "react";
import { Button, Surface } from "../../ui";
import { faceFor, type Face } from "./fontMatch";
import { sampleColors } from "./pageColors";
import { runFont, type RunFont } from "./runFont";
import type { Box } from "./selectionBoxes";
import styles from "./PdfTools.module.css";

/**
 * Edit text, as in Acrobat: point at words, click, and they open for typing in place, in their own
 * font, size and colour. Enter (or clicking away) keeps the change, which shows on the page at once
 * and is a step in Undo. Done, or Escape, leaves.
 */

export interface TextEdit {
  page: number;
  /** The old words' box, in the page's own coordinates. */
  box: Box;
  /** The words as they were, and as they are now. */
  was: string;
  text: string;
  run: RunFont | null;
  face: Face;
  /** Colours as printed (not as dark pages show them). */
  ink: string;
  paper: string;
}

interface Open {
  span: HTMLElement;
  page: HTMLElement;
  n: number;
  box: DOMRect;
  pageBox: Box;
  was: string;
  /** What's there now, if the words were edited already. */
  shown: string;
  run: RunFont | null;
  face: Face | null;
  ink: string;
  paper: string;
}

export function EditTextLayer({
  frame,
  viewer,
  shownText,
  onEdit,
  onDone,
}: {
  frame: HTMLIFrameElement;
  viewer: PDFViewer;
  /** The words' text after earlier edits, if any: editing them again starts from there. */
  shownText: (page: number, box: Box) => string | null;
  onEdit: (edit: TextEdit) => void;
  onDone: () => void;
}) {
  const doc = frame.contentDocument;
  const [hover, setHover] = useState<DOMRect | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [, redraw] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const scroller = doc?.getElementById("scroller");
    scroller?.addEventListener("scroll", redraw, { passive: true });
    return () => scroller?.removeEventListener("scroll", redraw);
  }, [doc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !open) onDone();
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

  /** A box on screen, in the page's own coordinates. */
  const toPage = (page: HTMLElement, box: DOMRect) => {
    const n = Number(page.dataset.pageNumber);
    const view = viewer.getPageView(n - 1)?.viewport;
    if (!view) return null;
    const p = page.getBoundingClientRect();
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
      box: [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)] as Box,
    };
  };

  const start = async (hit: { span: HTMLElement; page: HTMLElement }) => {
    const box = hit.span.getBoundingClientRect();
    const at = toPage(hit.page, box);
    if (!at) return;
    const was = hit.span.textContent ?? "";
    const colors = sampleColors(hit.page, box);
    const base = {
      ...hit,
      n: at.n,
      box,
      pageBox: at.box,
      was,
      shown: shownText(at.n, at.box) ?? was,
      run: null,
      face: null,
      ink: colors.ink,
      paper: colors.paper,
    };
    setOpen(base);
    // The words' own font, read from the PDF, for typing in it.
    const run = await runFont(viewer, at.n, at.box);
    const face = await faceFor(run?.name ?? null, run?.generic ?? "sans", {
      bold: run?.bold ?? false,
      italic: run?.italic ?? false,
    });
    setOpen((o) => (o && o.span === hit.span ? { ...o, run, face } : o));
  };

  const commit = async (text: string) => {
    const o = open;
    if (!o) return;
    setOpen(null);
    if (text === o.shown) return;
    const run = o.run ?? (await runFont(viewer, o.n, o.pageBox));
    const face =
      o.face ??
      (await faceFor(run?.name ?? null, run?.generic ?? "sans", {
        bold: run?.bold ?? false,
        italic: run?.italic ?? false,
      }));
    // Colours as read off the screen; the app turns dark pages' colours back to the file's.
    onEdit({
      page: o.n,
      box: o.pageBox,
      was: o.was,
      text,
      run,
      face,
      ink: o.ink,
      paper: o.paper,
    });
  };

  const view = open ? viewer.getPageView(open.n - 1)?.viewport : null;
  const px = open?.run && view ? open.run.size * view.scale : (open?.box.height ?? 16) * 0.8;

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
        void start(hit);
      }}
    >
      {hover && !open && (
        <div
          className={styles.editHover}
          style={{
            left: hover.left - 3,
            top: hover.top - 2,
            width: hover.width + 6,
            height: hover.height + 4,
          }}
        />
      )}
      {open && (
        <input
          key={`${open.n}-${open.pageBox.join()}`}
          className={styles.editInput}
          aria-label="Text"
          autoFocus
          spellCheck={false}
          defaultValue={open.shown}
          style={{
            left: open.box.left - 3,
            top: open.box.top - 2,
            minWidth: open.box.width + 6,
            width: `calc(${Math.max(open.shown.length, 4) + 2}ch + 6px)`,
            height: open.box.height + 4,
            fontSize: px,
            fontFamily: open.face?.css ?? "Arial, sans-serif",
            fontWeight: open.face?.bold ? 700 : 400,
            fontStyle: open.face?.italic ? "italic" : "normal",
            color: open.ink,
            background: open.paper,
          }}
          onFocus={(e) => e.currentTarget.select()}
          onInput={(e) => {
            const input = e.currentTarget;
            input.style.width = `calc(${Math.max(input.value.length, 4) + 2}ch + 6px)`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit(e.currentTarget.value);
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(null);
            }
          }}
          onBlur={(e) => void commit(e.currentTarget.value)}
        />
      )}
      <Surface material="glass" strength="thick" floating className={styles.placeBar}>
        <span className={styles.placeHint}>Click text to edit it</span>
        <Button size="small" onClick={onDone}>
          Done
        </Button>
      </Surface>
    </div>
  );
}
