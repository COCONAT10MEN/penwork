import type { PDFDocumentProxy } from "pdfjs-dist";
import { useRef } from "react";
import { describePages, pageSet } from "../../lib/pdftools/ranges";
import { Button, Icon, TextField } from "../../ui";
import { PageThumb } from "./PageThumb";
import styles from "./PdfTools.module.css";

/**
 * Pages picked by looking at them: click a page to pick it, Shift+click for every page up to it.
 * The same pages can be typed ("1-3, 5"); the two stay in step.
 */
export function PagePicker({
  doc,
  ranges,
  onChange,
}: {
  doc: PDFDocumentProxy;
  /** The picked pages, written as ranges. */
  ranges: string;
  onChange: (ranges: string) => void;
}) {
  const count = doc.numPages;
  const picked = new Set(pageSet(ranges, count) ?? []);
  const anchor = useRef<number | null>(null);
  const set = (pages: Iterable<number>) => onChange(describePages([...pages]));

  const press = (n: number, shift: boolean) => {
    const next = new Set(picked);
    if (shift && anchor.current !== null) {
      const [a, b] = [Math.min(anchor.current, n), Math.max(anchor.current, n)];
      for (let i = a; i <= b; i++) next.add(i);
    } else if (next.has(n)) next.delete(n);
    else next.add(n);
    anchor.current = n;
    set(next);
  };

  return (
    <div className={styles.pagePicker}>
      <div className={styles.pickerHead}>
        <span className={styles.pickerCount}>
          {picked.size === 0
            ? "No pages picked"
            : `${picked.size} of ${count} ${count === 1 ? "page" : "pages"}`}
        </span>
        <Button
          variant="text"
          size="small"
          onClick={() => set(Array.from({ length: count }, (_, i) => i + 1))}
        >
          All
        </Button>
        <Button variant="text" size="small" disabled={!picked.size} onClick={() => onChange("")}>
          None
        </Button>
      </div>
      <div className={styles.pickerGrid} role="group" aria-label="Pages">
        {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={`pw-state ${styles.pickerPage}`}
            aria-pressed={picked.has(n)}
            aria-label={`Page ${n}`}
            onClick={(e) => press(n, e.shiftKey)}
          >
            <PageThumb doc={doc} page={n} size={64} />
            <span className={styles.pickerNumber}>{n}</span>
            {picked.has(n) && (
              <span className={styles.pickerCheck} aria-hidden="true">
                <Icon name="check" size={16} />
              </span>
            )}
          </button>
        ))}
      </div>
      <TextField
        label="Or type them"
        value={ranges}
        placeholder={`1-3, 5, 8-${count}`}
        onChange={onChange}
      />
    </div>
  );
}
