import { Reorder, useDragControls } from "motion/react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useState } from "react";
import { describePages } from "../../lib/pdftools/ranges";
import { useSpring } from "../../theme/motion";
import { Button, Icon, IconButton, NumberField, SegmentedButton } from "../../ui";
import { loadPdf, PDF_ASSETS } from "../office/pdfLoader";
import { pickFiles, type Picked } from "./files";
import { splitParts, type MergeItem, type SplitValue } from "./pageToolValues";
import { PageThumb } from "./PageThumb";
import styles from "./PdfTools.module.css";

/* ---------- Split ---------- */

/** Split: one file per page, per few pages, or per range picked with steppers, with what it makes. */
export function SplitField({
  count,
  value,
  onChange,
}: {
  count: number;
  value: SplitValue;
  onChange: (v: SplitValue) => void;
}) {
  const parts = splitParts(value, count);
  const setRange = (i: number, range: [number, number]) =>
    onChange({ ...value, ranges: value.ranges.map((r, j) => (j === i ? range : r)) });
  const addRange = () => {
    const last = value.ranges[value.ranges.length - 1];
    const from = Math.min(count, (last?.[1] ?? 0) + 1);
    onChange({ ...value, ranges: [...value.ranges, [from, count]] });
  };
  return (
    <div className={styles.fields}>
      <div className={styles.field}>
        <span className={styles.label}>Split into</span>
        <SegmentedButton
          label="Split into"
          required
          options={[
            { value: "every", label: "Single pages" },
            { value: "n", label: "Equal parts" },
            { value: "ranges", label: "Ranges" },
          ]}
          value={value.how}
          onChange={(how) => onChange({ ...value, how: how as SplitValue["how"] })}
        />
      </div>
      {value.how === "n" && (
        <NumberField
          label="Pages in each file"
          min={1}
          max={Math.max(1, count)}
          value={Math.min(value.n, count)}
          onChange={(n) => onChange({ ...value, n })}
        />
      )}
      {value.how === "ranges" && (
        <div className={styles.field}>
          <span className={styles.label}>Ranges</span>
          <ol className={styles.ranges}>
            {value.ranges.map(([from, to], i) => (
              <li key={i} className={styles.rangeRow}>
                <span className={styles.rangeName}>File {i + 1}</span>
                <NumberField
                  label={`File ${i + 1}, from page`}
                  hideLabel
                  min={1}
                  max={count}
                  value={from}
                  onChange={(n) => setRange(i, [n, Math.max(n, to)])}
                />
                <span className={styles.rangeTo}>to</span>
                <NumberField
                  label={`File ${i + 1}, to page`}
                  hideLabel
                  min={1}
                  max={count}
                  value={to}
                  onChange={(n) => setRange(i, [Math.min(from, n), n])}
                />
                <IconButton
                  size="compact"
                  icon="close"
                  label={`Remove file ${i + 1}`}
                  disabled={value.ranges.length < 2}
                  onClick={() =>
                    onChange({ ...value, ranges: value.ranges.filter((_, j) => j !== i) })
                  }
                />
              </li>
            ))}
          </ol>
          <Button variant="tonal" size="small" icon="add" onClick={addRange}>
            Add range
          </Button>
        </div>
      )}
      <div className={styles.field}>
        <span className={styles.label}>
          {parts.length === 1 ? "Makes 1 file" : `Makes ${parts.length} files`}
        </span>
        <div className={styles.partChips}>
          {parts.slice(0, 24).map((p, i) => (
            <span key={i} className={styles.partChip}>
              {describePages(p).replace("-", "–")}
            </span>
          ))}
          {parts.length > 24 && <span className={styles.partChip}>+{parts.length - 24}</span>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Merge ---------- */

/** A picked PDF, opened just far enough to show its first page and count its pages. */
function useOpened(file: Picked | null) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  useEffect(() => {
    if (!file) return;
    let gone = false;
    let task: { destroy: () => Promise<void> } | null = null;
    void loadPdf()
      .then(({ pdfjs }) => {
        const opening = pdfjs.getDocument({ ...PDF_ASSETS, data: file.bytes.slice() });
        task = opening;
        if (gone) void opening.destroy();
        return opening.promise;
      })
      .then((d) => {
        if (!gone) setDoc(d);
      })
      .catch(() => {});
    return () => {
      gone = true;
      void task?.destroy();
    };
  }, [file]);
  return doc;
}

function MergeRow({
  item,
  index,
  total,
  here,
  name,
  onMove,
  onRemove,
}: {
  item: MergeItem;
  index: number;
  total: number;
  here: PDFDocumentProxy;
  name: string;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const drag = useDragControls();
  const spring = useSpring("spatialFast");
  const opened = useOpened(item.file);
  const doc = item.file ? opened : here;
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={drag}
      transition={spring}
      className={styles.mergeRow}
      data-this={!item.file || undefined}
    >
      <span
        className={styles.dragHandle}
        onPointerDown={(e) => drag.start(e)}
        aria-hidden="true"
        title="Drag to move"
      >
        <Icon name="drag_indicator" size={20} />
      </span>
      <span className={styles.mergeThumb}>{doc && <PageThumb doc={doc} page={1} size={44} />}</span>
      <span className={styles.mergeText}>
        <span className={styles.mergeName}>{item.file ? item.file.name : name}</span>
        <span className={styles.mergeMeta}>
          {item.file ? "" : "This PDF · "}
          {doc ? `${doc.numPages} ${doc.numPages === 1 ? "page" : "pages"}` : "…"}
        </span>
      </span>
      <IconButton
        size="compact"
        icon="arrow_upward"
        label="Move up"
        disabled={index === 0}
        onClick={() => onMove(-1)}
      />
      <IconButton
        size="compact"
        icon="arrow_downward"
        label="Move down"
        disabled={index === total - 1}
        onClick={() => onMove(1)}
      />
      {item.file ? (
        <IconButton size="compact" icon="close" label="Remove" onClick={onRemove} />
      ) : (
        <span className={styles.iconGap} />
      )}
    </Reorder.Item>
  );
}

/** Merge: this PDF and the ones added, in the order they'll go, by dragging or the arrows. */
export function MergeField({
  here,
  name,
  value,
  onChange,
}: {
  here: PDFDocumentProxy;
  name: string;
  value: MergeItem[];
  onChange: (v: MergeItem[]) => void;
}) {
  const move = (i: number, by: number) => {
    const next = [...value];
    const [item] = next.splice(i, 1);
    if (item) next.splice(Math.max(0, Math.min(next.length, i + by)), 0, item);
    onChange(next);
  };
  return (
    <div className={styles.field}>
      <span className={styles.label}>Order</span>
      <Reorder.Group axis="y" values={value} onReorder={onChange} className={styles.mergeList}>
        {value.map((item, i) => (
          <MergeRow
            key={item.id}
            item={item}
            index={i}
            total={value.length}
            here={here}
            name={name}
            onMove={(by) => move(i, by)}
            onRemove={() => onChange(value.filter((x) => x !== item))}
          />
        ))}
      </Reorder.Group>
      <Button
        variant="tonal"
        size="small"
        icon="add"
        onClick={async () => {
          const more = await pickFiles("pdf", true);
          if (more.length)
            onChange([
              ...value,
              ...more.map((file, i) => ({ id: `${Date.now()}-${i}-${file.name}`, file })),
            ]);
        }}
      >
        Add PDFs
      </Button>
    </div>
  );
}
