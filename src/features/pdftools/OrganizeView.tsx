import { motion } from "motion/react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import type { PageOrder } from "../../lib/pdftools/pages";
import { useSpring } from "../../theme/motion";
import { Button, IconButton, Surface } from "../../ui";
import styles from "./PdfTools.module.css";

/**
 * Organize: every page as a card. Pick some (click, Ctrl, Shift), drag them to a new place, turn,
 * copy or delete them, add blank pages. Nothing changes in the file until Done.
 */

interface Card {
  key: number;
  /** Index in the PDF now, or null for a new blank page. */
  from: number | null;
  turn: number;
}

function Thumb({ doc, card }: { doc: PDFDocumentProxy; card: Card }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const watch = new IntersectionObserver(([e]) => e?.isIntersecting && setSeen(true), {
      rootMargin: "300px",
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  useEffect(() => {
    if (!seen || card.from === null || !canvas.current) return;
    let task: { cancel: () => void } | null = null;
    let gone = false;
    void doc.getPage(card.from + 1).then((page) => {
      if (gone || !canvas.current) return;
      const base = page.getViewport({ scale: 1 });
      const view = page.getViewport({
        scale: (150 * devicePixelRatio) / Math.max(base.width, base.height),
      });
      canvas.current.width = view.width;
      canvas.current.height = view.height;
      const ctx = canvas.current.getContext("2d");
      if (!ctx) return;
      const render = page.render({ canvasContext: ctx, canvas: canvas.current, viewport: view });
      task = render;
      render.promise.catch(() => {});
    });
    return () => {
      gone = true;
      task?.cancel();
    };
  }, [seen, doc, card.from]);
  return (
    <span className={styles.thumbBox}>
      <canvas
        ref={canvas}
        className={styles.thumb}
        data-blank={card.from === null || undefined}
        style={{ rotate: `${card.turn}deg` }}
      />
    </span>
  );
}

export function OrganizeView({
  doc,
  onDone,
  onExtract,
}: {
  doc: PDFDocumentProxy;
  onDone: (order: (PageOrder | "blank")[] | null) => void;
  onExtract: (pages: number[]) => void;
}) {
  const [cards, setCards] = useState<Card[]>(() =>
    Array.from({ length: doc.numPages }, (_, i) => ({ key: i, from: i, turn: 0 })),
  );
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [drag, setDrag] = useState<{
    keys: number[];
    x: number;
    y: number;
    over: number | null;
  } | null>(null);
  const nextKey = useRef(doc.numPages);
  const grid = useRef<HTMLDivElement>(null);
  const press = useRef<{ key: number; x: number; y: number } | null>(null);
  const spring = useSpring("spatialDefault");

  const chosen = cards.filter((c) => picked.has(c.key));
  const targets = chosen.length ? chosen : [];

  const pick = (key: number, e: React.MouseEvent | React.PointerEvent) => {
    if (e.shiftKey && anchor !== null) {
      const a = cards.findIndex((c) => c.key === anchor);
      const b = cards.findIndex((c) => c.key === key);
      setPicked(new Set(cards.slice(Math.min(a, b), Math.max(a, b) + 1).map((c) => c.key)));
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(picked);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setPicked(next);
    } else setPicked(new Set([key]));
    setAnchor(key);
  };

  const turn = (by: number) =>
    setCards((all) =>
      all.map((c) => (picked.has(c.key) ? { ...c, turn: (c.turn + by + 360) % 360 } : c)),
    );
  const remove = () => {
    if (picked.size >= cards.length) return;
    setCards((all) => all.filter((c) => !picked.has(c.key)));
    setPicked(new Set());
  };
  const copy = () =>
    setCards((all) =>
      all.flatMap((c) => (picked.has(c.key) ? [c, { ...c, key: nextKey.current++ }] : [c])),
    );
  const blank = () => {
    const last = Math.max(...cards.map((c, i) => (picked.has(c.key) ? i : -1)));
    const at = last < 0 ? cards.length : last + 1;
    setCards((all) => [
      ...all.slice(0, at),
      { key: nextKey.current++, from: null, turn: 0 },
      ...all.slice(at),
    ]);
  };

  // Delete removes, Ctrl+A picks every page, Esc leaves without changes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") remove();
      else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setPicked(new Set(cards.map((c) => c.key)));
      } else if (e.key === "Escape") onDone(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** Which card the pointer is over, so the dragged ones go in front of it. */
  const overIndex = (x: number, y: number) => {
    const els = grid.current?.querySelectorAll<HTMLElement>("[data-card]") ?? [];
    let best = cards.length;
    for (let i = 0; i < els.length; i++) {
      const r = els[i]?.getBoundingClientRect();
      if (!r) continue;
      if (y < r.top - 8) continue;
      if (y <= r.bottom + 8 && x < r.left + r.width / 2) return i;
      if (y <= r.bottom + 8) best = i + 1;
    }
    return best;
  };

  const drop = () => {
    if (!drag || drag.over === null) return;
    const moving = cards.filter((c) => drag.keys.includes(c.key));
    const before = cards.slice(0, drag.over).filter((c) => !drag.keys.includes(c.key));
    const after = cards.slice(drag.over).filter((c) => !drag.keys.includes(c.key));
    setCards([...before, ...moving, ...after]);
  };

  return (
    <div className={styles.organize}>
      <Surface material="glass" strength="thick" floating className={styles.organizeBar}>
        <span className={styles.placeHint}>
          {picked.size ? `${picked.size} picked` : "Pick pages, or drag them into order"}
        </span>
        <IconButton
          icon="rotate_left"
          label="Turn left"
          disabled={!picked.size}
          onClick={() => turn(-90)}
        />
        <IconButton
          icon="rotate_right"
          label="Turn right"
          disabled={!picked.size}
          onClick={() => turn(90)}
        />
        <IconButton icon="content_copy" label="Copy" disabled={!picked.size} onClick={copy} />
        <IconButton icon="note_add" label="Add a blank page after" onClick={blank} />
        <IconButton
          icon="file_export"
          label="Save the picked pages as a new PDF"
          disabled={!targets.length || targets.some((c) => c.from === null)}
          onClick={() => onExtract(targets.map((c) => (c.from ?? 0) + 1))}
        />
        <IconButton
          icon="delete"
          label="Delete"
          disabled={!picked.size || picked.size >= cards.length}
          onClick={remove}
        />
        <Button variant="tonal" size="small" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button
          size="small"
          onClick={() =>
            onDone(cards.map((c) => (c.from === null ? "blank" : { from: c.from, turn: c.turn })))
          }
        >
          Done
        </Button>
      </Surface>
      <div
        ref={grid}
        className={styles.grid}
        onPointerMove={(e) => {
          const p = press.current;
          if (!p) return;
          if (!drag && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
          const keys = picked.has(p.key)
            ? cards.filter((c) => picked.has(c.key)).map((c) => c.key)
            : [p.key];
          setDrag({ keys, x: e.clientX, y: e.clientY, over: overIndex(e.clientX, e.clientY) });
        }}
        onPointerUp={() => {
          drop();
          press.current = null;
          setDrag(null);
        }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) setPicked(new Set());
        }}
      >
        {cards.map((c, i) => (
          <motion.button
            key={c.key}
            layout
            transition={spring}
            type="button"
            data-card
            className={`pw-state ${styles.card}`}
            data-picked={picked.has(c.key) || undefined}
            data-dragging={drag?.keys.includes(c.key) || undefined}
            data-drop={drag && drag.over === i ? "before" : undefined}
            aria-pressed={picked.has(c.key)}
            aria-label={c.from === null ? "Blank page" : `Page ${c.from + 1}`}
            onPointerDown={(e) => {
              // Keeps the drag when the pointer leaves the grid; a finished press has nothing to keep.
              try {
                e.currentTarget.parentElement?.setPointerCapture(e.pointerId);
              } catch {
                /* the pointer is already up */
              }
              press.current = { key: c.key, x: e.clientX, y: e.clientY };
              if (!picked.has(c.key) || e.ctrlKey || e.shiftKey) pick(c.key, e);
            }}
          >
            <Thumb doc={doc} card={c} />
            <span className={styles.cardNumber}>{i + 1}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
