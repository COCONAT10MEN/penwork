import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import styles from "./PdfTools.module.css";

/**
 * A page as a small picture, drawn only once it scrolls near sight, so a long PDF's page list
 * costs nothing until it's looked at. `page` is from 1; null is a blank page to be.
 */
export function PageThumb({
  doc,
  page,
  turn = 0,
  size = 150,
}: {
  doc: PDFDocumentProxy;
  page: number | null;
  turn?: number;
  size?: number;
}) {
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
    if (!seen || page === null || !canvas.current) return;
    let task: { cancel: () => void } | null = null;
    let gone = false;
    void doc.getPage(page).then((p) => {
      if (gone || !canvas.current) return;
      const base = p.getViewport({ scale: 1 });
      const view = p.getViewport({
        scale: (size * devicePixelRatio) / Math.max(base.width, base.height),
      });
      canvas.current.width = view.width;
      canvas.current.height = view.height;
      const ctx = canvas.current.getContext("2d");
      if (!ctx) return;
      const render = p.render({ canvasContext: ctx, canvas: canvas.current, viewport: view });
      task = render;
      render.promise.catch(() => {});
    });
    return () => {
      gone = true;
      task?.cancel();
    };
  }, [seen, doc, page, size]);
  return (
    <span className={styles.thumbBox} style={{ width: size, height: size }}>
      <canvas
        ref={canvas}
        className={styles.thumb}
        data-blank={page === null || undefined}
        style={{
          rotate: `${turn}deg`,
          maxWidth: size,
          maxHeight: size,
          ...(page === null ? { width: size * 0.707, height: size } : {}),
        }}
      />
    </span>
  );
}
