import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import styles from "./TextField.module.css";

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Help text under the field. */
  supporting?: string;
  /** Shown in place of the help text, and marks the field invalid. */
  error?: string;
  /** Something inside the end of the field, e.g. a color swatch. */
  trailing?: ReactNode;
}

/** Label above a filled field, as in the Edit mockup's inspector. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, value, onChange, supporting, error, trailing, className, disabled, ...rest },
  ref,
) {
  const id = useId();
  const helpId = useId();
  const help = error ?? supporting;
  return (
    <div className={cx(styles.root, className)} data-disabled={disabled || undefined}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.field} data-error={error ? true : undefined}>
        <input
          spellCheck={false}
          autoComplete="off"
          ref={ref}
          id={id}
          className={styles.input}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={help ? helpId : undefined}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
        {trailing}
      </div>
      {help && (
        <p id={helpId} className={error ? styles.errorText : styles.help}>
          {help}
        </p>
      )}
    </div>
  );
});
