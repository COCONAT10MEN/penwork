import { useRef, type KeyboardEvent } from "react";
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
 *
 * Single-select (a string value) is a radio group: one Tab stop, arrow keys move and select.
 * Multi-select (an array) is a row of toggle buttons with aria-pressed.
 */
export function ButtonGroup<V extends string | string[]>({
  label,
  options,
  value,
  onChange,
  required,
  size = "small",
}: ButtonGroupProps<V>) {
  const single = !Array.isArray(value);
  const groupRef = useRef<HTMLDivElement>(null);
  const enabled = options.filter((o) => !o.disabled);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!single) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step || enabled.length === 0) return;
    e.preventDefault();
    const at = enabled.findIndex((o) => o.value === value);
    const next = enabled[(at + step + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value as V);
    groupRef.current
      ?.querySelector<HTMLElement>(`[data-value="${CSS.escape(next.value)}"]`)
      ?.focus();
  };

  return (
    <div
      ref={groupRef}
      role={single ? "radiogroup" : "group"}
      aria-label={label}
      className={cx(styles.group, styles[size])}
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => {
        const selected = isSelected(value, option.value);
        // Radio groups have one Tab stop: the selected option (or the first if none is).
        const tabStop =
          !single || selected || (!enabled.some((o) => o.value === value) && option === enabled[0]);
        const button = (
          <button
            key={option.value}
            type="button"
            role={single ? "radio" : undefined}
            aria-checked={single ? selected : undefined}
            aria-pressed={single ? undefined : selected}
            aria-label={option.label ? undefined : option.ariaLabel}
            tabIndex={tabStop ? 0 : -1}
            data-value={option.value}
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
