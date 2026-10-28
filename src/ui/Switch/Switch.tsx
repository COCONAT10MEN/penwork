import { useId } from "react";
import { cx } from "../cx";
import { Icon } from "../Icon";
import styles from "./Switch.module.css";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label next to the switch; clicking it toggles too. */
  label: string;
  /** Extra line under the label. */
  description?: string;
  disabled?: boolean;
}

/** M3 switch. The handle grows and shows a check when on. */
export function Switch({ checked, onCheckedChange, label, description, disabled }: SwitchProps) {
  const labelId = useId();
  const descId = useId();
  return (
    <div className={cx(styles.row, disabled && styles.disabled)}>
      <span className={styles.text}>
        <span
          id={labelId}
          className={styles.label}
          onClick={() => !disabled && onCheckedChange(!checked)}
        >
          {label}
        </span>
        {description && (
          <span id={descId} className={styles.description}>
            {description}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        disabled={disabled}
        data-checked={checked || undefined}
        className={styles.track}
        onClick={() => onCheckedChange(!checked)}
      >
        <span className={cx("pw-state", styles.handle)}>
          {checked && <Icon name="check" size={16} />}
        </span>
      </button>
    </div>
  );
}
