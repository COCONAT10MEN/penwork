import type { PDFDocumentProxy } from "pdfjs-dist";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { Tabs } from "../../ui";
import { cx } from "../../ui/cx";
import styles from "./PdfSidebar.module.css";

const THUMB_WIDTH = 150;

type Outline = Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>;

/**
 * Draws one small page when it scrolls into the panel, and only once. Drawing all of a long PDF up
 * front would hold the reader up for nothing.
 */
function Thumb({
  document,
  number,
  current,
  ratio,
  settled,
  onGo,
}: {
  document: PDFDocumentProxy;
  number: number;
  current: boolean;
  ratio: number;
  /** Drawing waits until the panel has stopped moving, so the slide stays smooth. */
  settled: boolean;
  onGo: (page: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const target = button.current;
    if (!target || drawn || !settled) return;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || task) return;
        void document.getPage(number).then((page) => {
          const box = canvas.current;
          if (!box) return;
          const fit = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (THUMB_WIDTH * 1.5) / fit.width });
          box.width = viewport.width;
          box.height = viewport.height;
          task = page.render({ canvas: box, viewport });
          task.promise.then(
            () => setDrawn(true),
            () => {},
          );
        });
      },
      { rootMargin: "300px 0px" },
    );
    watcher.observe(target);
    return () => {
      watcher.disconnect();
      task?.cancel();
    };
  }, [document, number, drawn, settled]);

  useEffect(() => {
    if (current) button.current?.scrollIntoView({ block: "nearest" });
  }, [current]);

  return (
    <button
      ref={button}
      type="button"
      className={cx("pw-state", styles.thumb)}
      aria-current={current ? "page" : undefined}
      aria-label={`Page ${number}`}
      onClick={() => onGo(number)}
    >
      <canvas
        ref={canvas}
        className={styles.canvas}
        style={{ aspectRatio: `${1 / ratio}` }}
        data-drawn={drawn || undefined}
      />
      <span className={styles.number}>{number}</span>
    </button>
  );
}

function OutlineList({
  items,
  onGo,
}: {
  items: Outline;
  onGo: (dest: string | unknown[] | null) => void;
}) {
  return (
    <ul className={styles.outline}>
      {items.map((item, index) => (
        <li key={`${item.title}-${index}`}>
          <button
            type="button"
            className={cx("pw-state", styles.entry)}
            onClick={() => onGo(item.dest)}
          >
            {item.title}
          </button>
          {item.items.length > 0 && <OutlineList items={item.items} onGo={onGo} />}
        </li>
      ))}
    </ul>
  );
}

/** Small pages to jump between, and the PDF's own contents when it has them. */
export function PdfSidebar({
  document,
  page,
  onPage,
  onDestination,
}: {
  document: PDFDocumentProxy;
  page: number;
  onPage: (page: number) => void;
  onDestination: (dest: string | unknown[] | null) => void;
}) {
  const [view, setView] = useState("pages");
  const [outline, setOutline] = useState<Outline | null>(null);
  const [ratio, setRatio] = useState(1.294);
  const [settled, setSettled] = useState(false);
  const reduce = useReduceMotion();
  // A panel slides without overshoot: a bounce at the edge of the window would look broken.
  const slide = useSpring("effectsSlow");

  useEffect(() => {
    let cancelled = false;
    void document.getOutline().then((items) => {
      if (!cancelled) setOutline(items && items.length > 0 ? items : null);
    });
    void document.getPage(1).then((first) => {
      const { width, height } = first.getViewport({ scale: 1 });
      if (!cancelled) setRatio(height / width);
    });
    return () => {
      cancelled = true;
    };
  }, [document]);

  return (
    <motion.nav
      className={styles.panel}
      aria-label="Pages"
      initial={reduce ? { opacity: 0 } : { x: "-100%" }}
      animate={{ x: "0%", opacity: 1, transition: slide }}
      exit={reduce ? { opacity: 0 } : { x: "-100%", transition: slide }}
      onAnimationComplete={() => setSettled(true)}
    >
      {outline && (
        <div className={styles.tabs}>
          <Tabs
            label="Show"
            tabs={[
              { id: "pages", label: "Pages" },
              { id: "contents", label: "Contents" },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
      )}
      <div className={styles.scroll}>
        {view === "contents" && outline ? (
          <OutlineList items={outline} onGo={onDestination} />
        ) : (
          Array.from({ length: document.numPages }, (_, i) => (
            <Thumb
              key={i}
              document={document}
              number={i + 1}
              current={page === i + 1}
              ratio={ratio}
              settled={settled}
              onGo={onPage}
            />
          ))
        )}
      </div>
    </motion.nav>
  );
}
