import { cx } from "../cx";
import { Icon } from "../Icon";
import { isSelected, nextSelection } from "../selection";
import { Tooltip } from "../Tooltip/Tooltip";
import styles from "./ButtonGroup.module.css";

export interface GroupOption {
  value: string;
  /** Visible text. Without it the option is icon-only and `ariaLabel` is required. */
  label?: string;
  ariaLabel?: string;
  icon?: string;
  disabled?: boolean;
}

export interface ButtonGroupProps<V extends string | string[]> {
  /** Name of the whole group for screen readers. */
  label: string;
  options: GroupOption[];
  /** A string for single-select, an array for multi-select. */
  value: V;
  onChange: (value: V) => void;
  /** Multi-select only: keep at least one option selected. */
  required?: boolean;
  size?: "small" | "medium";
}

/**
 * M3 Expressive connected button group: tight segments with small inner corners. The
 * selected segment morphs to fully round.
 */
export function ButtonGroup<V extends string | string[]>({
  label,
  options,
  value,
  onChange,
  required,
  size = "small",
}: ButtonGroupProps<V>) {
  return (
    <div role="group" aria-label={label} className={cx(styles.group, styles[size])}>
      {options.map((option, index) => {
        const selected = isSelected(value, option.value);
        const button = (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={option.label ? undefined : option.ariaLabel}
            data-selected={selected || undefined}
            data-first={index === 0 || undefined}
            data-last={index === options.length - 1 || undefined}
            disabled={option.disabled}
            className={cx("pw-state", styles.segment, !option.label && styles.iconOnly)}
            onClick={() => onChange(nextSelection(value, option.value, required) as V)}
          >
            {option.icon && (
              <Icon name={option.icon} filled={selected} size={size === "medium" ? 24 : 20} />
            )}
            {option.label}
          </button>
        );
        return option.label ? (
          button
        ) : (
          <Tooltip key={option.value} text={option.ariaLabel ?? ""} describes={false}>
            {button}
          </Tooltip>
        );
      })}
    </div>
  );
}
