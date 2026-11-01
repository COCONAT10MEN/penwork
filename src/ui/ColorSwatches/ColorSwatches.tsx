import { Icon } from "../Icon";
import { Shape } from "../Shape/Shape";
import { cx } from "../cx";
import styles from "./ColorSwatches.module.css";

export interface ColorSwatchesProps {
  /** Name of the whole set for screen readers. */
  label: string;
  /** #rrggbb */
  colors: string[];
  value: string;
  onChange: (hex: string) => void;
}

/** Colours as soft cookies. The picked one morphs into a flower with a tick. */
export function ColorSwatches({ label, colors, value, onChange }: ColorSwatchesProps) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.swatches}>
      {colors.map((color) => {
        const picked = color.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={picked}
            aria-label={`Colour ${color}`}
            className={cx("pw-state pw-press", styles.swatch)}
            onClick={() => onChange(color)}
          >
            <Shape
              name={picked ? "Flower" : "Cookie9Sided"}
              size={picked ? 44 : 36}
              solid
              color={color}
              className={styles.shape}
            >
              {picked && <Icon name="check" size={22} className={styles.tick} />}
            </Shape>
          </button>
        );
      })}
    </div>
  );
}
