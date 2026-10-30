import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { clamp } from "../../lib/clamp";
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from "../../lib/color";
import { Button } from "../Button/Button";
import { TextField } from "../TextField/TextField";
import styles from "./ColorPicker.module.css";

export interface ColorPickerProps {
  /** #rrggbb */
  value: string;
  onChange: (hex: string) => void;
  /** Shows "Save to my colours". */
  onSave?: (hex: string) => void;
}

const STEP = 0.01;

/** Saturation/value square, hue slider, hex field and live preview. No eyedropper, as in the template. */
export function ColorPicker({ value, onChange, onSave }: ColorPickerProps) {
  // Kept as HSV: on black or gray the hex alone would forget which hue was chosen.
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [seen, setSeen] = useState(value);
  const [draft, setDraft] = useState<string | null>(null);
  const square = useRef<HTMLDivElement>(null);

  if (value !== seen) {
    setSeen(value);
    if (value !== hsvToHex(hsv)) setHsv(hexToHsv(value));
  }

  const update = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setSeen(hex);
    onChange(hex);
  };

  const fromPointer = (e: PointerEvent) => {
    const r = square.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return;
    update({
      ...hsv,
      s: clamp((e.clientX - r.left) / r.width, 0, 1),
      v: 1 - clamp((e.clientY - r.top) / r.height, 0, 1),
    });
  };

  const onSquareKey = (e: KeyboardEvent) => {
    const big = e.shiftKey ? 10 : 1;
    const delta = {
      ArrowRight: [STEP, 0],
      ArrowLeft: [-STEP, 0],
      ArrowUp: [0, STEP],
      ArrowDown: [0, -STEP],
    }[e.key];
    if (!delta) return;
    e.preventDefault();
    update({
      ...hsv,
      s: clamp(hsv.s + (delta[0] as number) * big, 0, 1),
      v: clamp(hsv.v + (delta[1] as number) * big, 0, 1),
    });
  };

  const hex = hsvToHex(hsv);
  const style = {
    "--pw-hue": hsv.h,
    "--pw-s": hsv.s,
    "--pw-v": hsv.v,
    "--pw-color": hex,
  } as CSSProperties;

  return (
    <div className={styles.picker} style={style}>
      <div
        ref={square}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        className={styles.square}
        onKeyDown={onSquareKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e);
        }}
      >
        <span className={styles.squareThumb} />
      </div>

      <input
        type="range"
        aria-label="Hue"
        className={styles.hue}
        min={0}
        max={360}
        step={1}
        value={Math.round(hsv.h)}
        onChange={(e) => update({ ...hsv, h: Number(e.target.value) })}
      />

      <div className={styles.row}>
        <span className={styles.preview} aria-hidden="true" />
        <TextField
          label="Hex color"
          className={styles.hex}
          value={draft ?? hex}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          error={draft !== null && !normalizeHex(draft) ? "Use a color like #E5352B" : undefined}
          onChange={(text) => {
            setDraft(text);
            const parsed = normalizeHex(text);
            if (parsed) {
              setHsv(hexToHsv(parsed));
              setSeen(parsed);
              onChange(parsed);
            }
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setDraft(null);
          }}
        />
      </div>

      {onSave && (
        <Button variant="tonal" onClick={() => onSave(hex)}>
          Save to my colours
        </Button>
      )}
    </div>
  );
}
