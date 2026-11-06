import { useContext, useState, type ReactNode } from "react";
import { FlatSections } from "./settingsContexts";
import { Button, ButtonGroup, ColorPicker, Dialog, Shape, Surface } from "../../ui";
import styles from "./Settings.module.css";

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  if (useContext(FlatSections))
    return (
      <section className={styles.flat}>
        <h2 className={styles.title}>{title}</h2>
        {hint && <p className={styles.hint}>{hint}</p>}
        {children}
      </section>
    );
  return (
    <Surface material="glass" blur={false} className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      {hint && <p className={styles.hint}>{hint}</p>}
      {children}
    </Surface>
  );
}

/** A setting with a few fixed answers. Values are strings on screen, whatever they are on disk. */
export function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.choice}>
      <span className={styles.subtitle}>{label}</span>
      <ButtonGroup
        stretch
        label={label}
        required
        options={options.map((o) => ({ value: String(o.value), label: o.label }))}
        value={String(value)}
        onChange={(next) => {
          const found = options.find((o) => String(o.value) === next);
          if (found) onChange(found.value);
        }}
      />
    </div>
  );
}

export function ColorChoice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.color}>
      <Shape name="Cookie9Sided" size={44} solid color={value} />
      <span className={styles.hex}>{value.toUpperCase()}</span>
      <Button variant="tonal" size="small" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        headline={label}
        material="glass"
        actions={
          <Button size="medium" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <ColorPicker value={value} onChange={onChange} />
      </Dialog>
    </div>
  );
}
