import {
  Button,
  Chip,
  ColorSwatches,
  NumberField,
  SegmentedButton,
  Slider,
  Switch,
  TextField,
} from "../../ui";
import { PagePicker } from "./PagePicker";
import { MergeField, SplitField } from "./PageToolFields";
import { THIS_PDF, type MergeItem, type SplitValue } from "./pageToolValues";
import { pickFiles, type Picked } from "./files";
import { SHAPES, shapeSvg } from "../../lib/pdftools/shapes";
import { SignaturePad } from "./SignaturePad";
import type { PagesValue } from "./toolsPages";
import type { Field, ToolHost, Values } from "./types";
import styles from "./PdfTools.module.css";

const COLORS = ["#1b1b1f", "#d32f2f", "#1565c0", "#2e7d32", "#ef6c00", "#6a1b9a", "#9e9e9e"];

/** Fields that only matter for one choice of another field. */
function shown(field: Field, v: Values): boolean {
  if (field.key === "n") return v.how === "n";
  if (field.key === "ranges") return v.how === "ranges";
  if (field.key === "text" && "kind" in v) return v.kind !== "image";
  if (field.key === "files" && v.kind !== undefined) return v.kind === "image";
  if (field.key === "margin" && v.how !== undefined) return v.how === "margins";
  if (field.key === "color" && v.kind === "image") return false;
  if (
    (field.key === "title" ||
      field.key === "author" ||
      field.key === "subject" ||
      field.key === "keywords") &&
    v.clear
  )
    return false;
  return true;
}

export function ToolFields({
  fields,
  values,
  host,
  onChange,
}: {
  fields: Field[];
  values: Values;
  host: ToolHost;
  onChange: (v: Values) => void;
}) {
  const set = (key: string, value: unknown) => onChange({ ...values, [key]: value });
  return (
    <div className={styles.fields}>
      {fields
        .filter((f) => shown(f, values))
        .map((f) => {
          const value = values[f.key];
          switch (f.kind) {
            case "note":
              return (
                <p key={f.key} className={styles.note}>
                  {f.text}
                </p>
              );
            case "choice":
              return (
                <div key={f.key} className={styles.field}>
                  <span className={styles.label}>{f.label}</span>
                  <SegmentedButton
                    label={f.label}
                    required
                    options={f.options}
                    value={String(value)}
                    onChange={(v) => set(f.key, v)}
                  />
                </div>
              );
            case "chips": {
              const list = (value as string[]) ?? [];
              return (
                <div key={f.key} className={styles.field}>
                  <span className={styles.label}>{f.label}</span>
                  <div className={styles.chips}>
                    {f.options.map((o) => (
                      <Chip
                        key={o.value}
                        label={o.label}
                        selected={list.includes(o.value)}
                        onClick={() =>
                          set(
                            f.key,
                            list.includes(o.value)
                              ? list.filter((x) => x !== o.value)
                              : [...list, o.value],
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            }
            case "text":
              return (
                <TextField
                  key={f.key}
                  label={f.label}
                  value={String(value ?? "")}
                  placeholder={f.placeholder}
                  type={f.password ? "password" : "text"}
                  onChange={(v) => set(f.key, v)}
                />
              );
            case "slider": {
              const max = f.max === 9999 ? host.doc.numPages : f.max;
              return (
                <Slider
                  key={f.key}
                  label={f.label}
                  min={f.min}
                  max={max}
                  step={f.step}
                  value={Math.min(Number(value), max)}
                  format={f.format}
                  showValue
                  onChange={(v) => set(f.key, v)}
                />
              );
            }
            case "number": {
              const max = f.max === "pages" ? host.doc.numPages : f.max;
              return (
                <NumberField
                  key={f.key}
                  label={f.label}
                  min={f.min}
                  max={max}
                  value={Math.min(Number(value), max)}
                  onChange={(v) => set(f.key, v)}
                />
              );
            }
            case "split":
              return (
                <SplitField
                  key={f.key}
                  count={host.doc.numPages}
                  value={
                    (value as SplitValue | undefined) ?? {
                      how: "every",
                      n: 2,
                      ranges: [[1, host.doc.numPages]],
                    }
                  }
                  onChange={(v) => set(f.key, v)}
                />
              );
            case "merge":
              return (
                <MergeField
                  key={f.key}
                  here={host.doc}
                  name={host.name}
                  value={(value as MergeItem[] | undefined) ?? [THIS_PDF]}
                  onChange={(v) => set(f.key, v)}
                />
              );
            case "switch":
              return (
                <Switch
                  key={f.key}
                  label={f.label}
                  description={f.description}
                  checked={Boolean(value)}
                  onCheckedChange={(v) => set(f.key, v)}
                />
              );
            case "color":
              return (
                <div key={f.key} className={styles.field}>
                  <span className={styles.label}>{f.label}</span>
                  <ColorSwatches
                    label={f.label}
                    colors={COLORS}
                    value={String(value)}
                    onChange={(v) => set(f.key, v)}
                  />
                </div>
              );
            case "files": {
              const files = (value as Picked[]) ?? [];
              return (
                <div key={f.key} className={styles.field}>
                  <span className={styles.label}>{f.label}</span>
                  {files.length > 0 && (
                    <ul className={styles.files}>
                      {files.map((file, i) => (
                        <li key={file.path + i}>
                          <span>{file.name}</span>
                          <Button
                            variant="text"
                            size="small"
                            onClick={() =>
                              set(
                                f.key,
                                files.filter((_, j) => j !== i),
                              )
                            }
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    variant="tonal"
                    size="small"
                    icon={f.accept === "pdf" ? "picture_as_pdf" : "image"}
                    onClick={async () => {
                      const more = await pickFiles(f.accept, f.multiple);
                      if (more.length) set(f.key, f.multiple ? [...files, ...more] : more);
                    }}
                  >
                    {files.length && f.multiple
                      ? "Add more"
                      : files.length
                        ? "Pick another"
                        : f.multiple
                          ? "Pick files"
                          : "Pick a file"}
                  </Button>
                </div>
              );
            }
            case "signature":
              return <SignaturePad key={f.key} onChange={(s) => set(f.key, s)} />;
            case "shape":
              return (
                <div key={f.key} className={styles.field}>
                  <span className={styles.label}>{f.label}</span>
                  <div className={styles.shapes} role="radiogroup" aria-label={f.label}>
                    {SHAPES.map((shape) => (
                      <button
                        key={shape.id}
                        type="button"
                        role="radio"
                        aria-checked={value === shape.id}
                        aria-label={shape.label}
                        title={shape.label}
                        className={`pw-state ${styles.shapeChoice}`}
                        onClick={() => set(f.key, shape.id)}
                        // Our own drawing of the shape, made from the list above.
                        dangerouslySetInnerHTML={{ __html: shapeSvg(shape.id) }}
                      />
                    ))}
                  </div>
                </div>
              );
            case "pages": {
              const p = (value as PagesValue) ?? { which: "all", ranges: "" };
              return (
                <div key={f.key} className={styles.field}>
                  <span className={styles.label}>{f.label ?? "Pages"}</span>
                  <SegmentedButton
                    label={f.label ?? "Pages"}
                    required
                    options={[
                      { value: "all", label: "All" },
                      { value: "this", label: `This (${host.page})` },
                      { value: "some", label: "Some" },
                    ]}
                    value={p.which}
                    onChange={(which) => set(f.key, { ...p, which })}
                  />
                  {p.which === "some" && (
                    <PagePicker
                      doc={host.doc}
                      ranges={p.ranges}
                      onChange={(ranges) => set(f.key, { ...p, ranges })}
                    />
                  )}
                </div>
              );
            }
          }
        })}
    </div>
  );
}
