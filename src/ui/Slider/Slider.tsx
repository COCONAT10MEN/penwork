import { useId, type CSSProperties } from "react";
import styles from "./Slider.module.css";

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  /** When dragging ends, for a change worth one undo step. */
  onCommit?: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  /** How the value is read out and shown, e.g. (v) => `${v} pt`. */
  format?: (value: number) => string;
  showValue?: boolean;
  disabled?: boolean;
}

/**
 * M3 Expressive slider: thick rounded track with a gap around a tall bar handle. Built on
 * <input type="range"> so keyboard (arrows, PgUp/PgDn, Home/End) and screen readers just work.
 */
export function Slider({
  value,
  onChange,
  onCommit,
  label,
  min = 0,
  max = 100,
  step = 1,
  format = String,
  showValue = true,
  disabled,
}: SliderProps) {
  const id = useId();
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {showValue && (
          <output htmlFor={id} className={styles.value}>
            {format(value)}
          </output>
        )}
      </div>
      {/* The visible track is drawn with spans; the real (invisible) range input sits on top. */}
      <div
        className={styles.track}
        data-disabled={disabled || undefined}
        style={{ "--pw-pct": pct } as CSSProperties}
      >
        <span className={styles.active} />
        <span className={styles.inactive} />
        <span className={styles.stop} />
        <span className={styles.handle} />
        <input
          id={id}
          type="range"
          className={styles.input}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-valuetext={format(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={(e) => onCommit?.(Number(e.currentTarget.value))}
          onKeyUp={(e) => onCommit?.(Number(e.currentTarget.value))}
        />
      </div>
    </div>
  );
}
