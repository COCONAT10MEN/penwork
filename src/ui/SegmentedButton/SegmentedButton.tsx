import { cx } from "../cx";
import { Icon } from "../Icon";
import { isSelected, nextSelection } from "../selection";
import type { GroupOption } from "../ButtonGroup/ButtonGroup";
import styles from "./SegmentedButton.module.css";

export interface SegmentedButtonProps<V extends string | string[]> {
  label: string;
  /** Segments need visible text; icons are optional. */
  options: (GroupOption & { label: string })[];
  value: V;
  onChange: (value: V) => void;
  required?: boolean;
}

/** M3 segmented button: outlined segments, the selected ones tinted with a check mark. */
export function SegmentedButton<V extends string | string[]>({
  label,
  options,
  value,
  onChange,
  required,
}: SegmentedButtonProps<V>) {
  return (
    <div role="group" aria-label={label} className={styles.group}>
      {options.map((option) => {
        const selected = isSelected(value, option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            data-selected={selected || undefined}
            disabled={option.disabled}
            className={cx("pw-state", styles.segment)}
            onClick={() => onChange(nextSelection(value, option.value, required) as V)}
          >
            {selected ? (
              <Icon name="check" size={18} />
            ) : (
              option.icon && <Icon name={option.icon} size={18} />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
