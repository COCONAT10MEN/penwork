import { useId, useState } from "react";
import { cx } from "../cx";
import { IconButton } from "../IconButton/IconButton";
import styles from "./NumberField.module.css";

export interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Hides the label visually (it still names the field), for fields in a row with their own heading. */
  hideLabel?: boolean;
  className?: string;
}

/**
 * A whole number with − and + either side, as Office's spin boxes: type it, step it, or use the
 * arrow keys. Out-of-range typing settles to the nearest allowed number when the field is left.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  hideLabel = false,
  className,
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));
  // A new value from outside (a range moved by another field) replaces what's being typed.
  const [shownFor, setShownFor] = useState(value);
  if (shownFor !== value) {
    setShownFor(value);
    setDraft(null);
  }
  const settle = () => {
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null);
    if (draft.trim() !== "" && Number.isFinite(n)) onChange(clamp(n));
  };
  return (
    <div className={cx(styles.root, className)}>
      <label htmlFor={id} className={hideLabel ? "pw-visually-hidden" : styles.label}>
        {label}
      </label>
      <div className={styles.field}>
        <IconButton
          size="compact"
          icon="remove"
          label={`Less, ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - step))}
        />
        <input
          id={id}
          className={styles.input}
          inputMode="numeric"
          role="spinbutton"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onFocus={(e) => e.target.select()}
          onBlur={settle}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(clamp(value + (e.key === "ArrowUp" ? step : -step)));
            }
          }}
        />
        <IconButton
          size="compact"
          icon="add"
          label={`More, ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + step))}
        />
      </div>
    </div>
  );
}
