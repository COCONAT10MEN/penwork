import { forwardRef, useId, useRef, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "../Icon";
import { IconButton } from "../IconButton/IconButton";
import { surfaceClass, type SurfaceMaterial } from "../Surface/Surface";
import styles from "./SearchBar.module.css";

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the field (also used when no placeholder is shown). */
  label: string;
  placeholder?: string;
  onSubmit?: (value: string) => void;
  /** Extra buttons at the end, e.g. an avatar or filter button. */
  trailing?: ReactNode;
  /** "glass" for floating chrome; "tonal" (default) is the solid look. */
  material?: SurfaceMaterial;
}

/** M3 search bar: a 56px pill on surface-container-high. Escape clears it. */
export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { value, onChange, label, placeholder, onSubmit, trailing, material = "tonal" },
  ref,
) {
  const id = useId();
  const localRef = useRef<HTMLInputElement | null>(null);
  return (
    <form
      role="search"
      className={cx(styles.bar, material === "tonal" && styles.tonal, surfaceClass({ material }))}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(value);
      }}
    >
      <Icon name="search" className={styles.leading} />
      <label htmlFor={id} className="pw-visually-hidden">
        {label}
      </label>
      <input
        ref={(el) => {
          localRef.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        id={id}
        type="search"
        className={styles.input}
        value={value}
        placeholder={placeholder ?? label}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
        }}
      />
      {value && (
        <IconButton
          icon="close"
          label="Clear search"
          onClick={() => {
            onChange("");
            localRef.current?.focus();
          }}
        />
      )}
      {trailing}
    </form>
  );
});
