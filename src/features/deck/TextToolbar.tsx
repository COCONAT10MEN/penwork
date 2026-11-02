import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { TextBar } from "../../lib/deck/bridge";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { ColorPicker, ColorSwatches, IconButton, Shape, Surface } from "../../ui";
import type { RuntimeFrameHandle } from "./RuntimeFrame";
import styles from "./TextToolbar.module.css";

// Options to pick from, so these are data, not theme colours.
const SWATCHES = ["#c0562f", "#0e7f9e", "#2e7d32", "#7a4fbf", "#b4287a", "#111111"];
const HEIGHT = 56;
const FORMULA_HEIGHT = 58;
const WIDTH = 372;
const COLORS_HEIGHT = 420;
const GAP = 10;

/** Over the text being typed, or under it if there's no room above. */
function spot(bar: TextBar, frame: DOMRect, extra: number) {
  // The slide page is scaled to fit, so its pixels aren't the app's.
  const scale = frame.width / window.screen.width;
  const y = frame.top + bar.y * scale;
  const above = y - HEIGHT - extra - GAP;
  const top = above > 8 ? above : y + bar.h * scale + GAP;
  const left = frame.left + (bar.x + bar.w / 2) * scale - WIDTH / 2;
  return { x: Math.max(8, Math.min(window.innerWidth - WIDTH - 8, left)), y: top };
}

/**
 * The glass pill for formatting text on the slide. It lives in the app and the text in the slide
 * page, so a press must not take focus: the page would see that as typing being finished.
 */
export function TextToolbar({
  bar,
  formula,
  frame,
  onFormula,
  onFormulaDone,
}: {
  bar: TextBar | null;
  formula: string | null;
  frame: RefObject<RuntimeFrameHandle | null>;
  onFormula: (src: string) => void;
  onFormulaDone: () => void;
}) {
  const pop = useSpring("spatialFast");
  const fade = useSpring("effectsFast");
  const reduce = useReduceMotion();
  const field = useRef<HTMLInputElement>(null);
  const [last, setLast] = useState<TextBar | null>(bar);
  if (bar && bar !== last) setLast(bar);

  const writing = formula !== null;
  const [colors, setColors] = useState(false);
  const [color, setColor] = useState("#c0562f");
  if (!bar && colors) setColors(false);
  const toggleColors = () => {
    const next = !colors;
    setColors(next);
    // The hex box takes focus, which mustn't count as typing being finished.
    frame.current?.post("hold", { on: next });
  };
  const paint = (hex: string) => {
    setColor(hex);
    frame.current?.post("format", { cmd: "color", value: hex });
  };
  useEffect(() => {
    if (writing) field.current?.focus();
  }, [writing]);

  const send = (cmd: string) => frame.current?.post("format", { cmd });
  const box = frame.current?.rect();
  const at =
    last && box
      ? spot(last, box, (writing ? FORMULA_HEIGHT : 0) + (colors ? COLORS_HEIGHT : 0))
      : { x: 0, y: 0 };

  const colorButton = (cmd: string, label: string, tint: string, on: boolean) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      data-on={on || undefined}
      className={`pw-state pw-press ${styles.color}`}
      onClick={() => send(cmd)}
    >
      <Shape name={on ? "Flower" : "Circle"} size={on ? 26 : 20} solid color={tint} />
    </button>
  );

  return createPortal(
    <AnimatePresence>
      {bar && last && (
        <motion.div
          className={styles.place}
          style={{ transformOrigin: "50% 100%" }}
          initial={
            reduce ? { opacity: 0, x: at.x, y: at.y } : { opacity: 0, scale: 0.8, x: at.x, y: at.y }
          }
          animate={{
            opacity: 1,
            scale: 1,
            x: at.x,
            y: at.y,
            transition: { default: pop, opacity: fade },
          }}
          exit={{ opacity: 0, scale: reduce ? 1 : 0.8, transition: fade }}
          // Text stays selected in the slide page while these are used.
          onPointerDown={(e) => {
            if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
          }}
          onMouseDown={(e) => {
            if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
          }}
        >
          <Surface
            material="glass"
            strength="thick"
            floating
            className={styles.bar}
            role="toolbar"
            aria-label="Text formatting"
          >
            <IconButton
              icon="format_bold"
              label="Bold"
              selected={last.bold}
              onClick={() => send("bold")}
            />
            <IconButton
              icon="format_italic"
              label="Italic"
              selected={last.italic}
              onClick={() => send("italic")}
            />
            {colorButton("orange", "Orange emphasis", "var(--pw-slide-orange)", last.orange)}
            {colorButton("teal", "Teal", "var(--pw-slide-teal)", last.teal)}
            {colorButton("muted", "Muted", "var(--pw-slide-muted)", last.muted)}
            <IconButton
              icon="palette"
              label="All colours"
              selected={colors}
              onClick={toggleColors}
            />
            <span className={styles.line} aria-hidden="true" />
            <IconButton icon="function" label="Insert formula" onClick={() => send("formula")} />
            <IconButton
              icon="format_clear"
              label="Clear formatting"
              onClick={() => send("clear")}
            />
          </Surface>
          {colors && (
            <Surface material="glass" strength="thick" floating className={styles.colors}>
              <ColorSwatches label="Colours" colors={SWATCHES} value={color} onChange={paint} />
              <ColorPicker value={color} onChange={paint} />
            </Surface>
          )}
          {writing && (
            <Surface material="glass" strength="thick" floating className={styles.formula}>
              <label className="pw-visually-hidden" htmlFor="pw-formula">
                Formula
              </label>
              <input
                ref={field}
                id="pw-formula"
                className={styles.input}
                value={formula}
                placeholder="a = F/m"
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => onFormula(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") {
                    e.preventDefault();
                    onFormulaDone();
                  }
                }}
              />
              <IconButton icon="check" label="Done" onClick={onFormulaDone} />
            </Surface>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
