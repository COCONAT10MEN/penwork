import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSpring } from "../../theme/motion";
import { Button, ColorPicker, ColorSwatches, Dialog, Slider, Surface, Switch } from "../../ui";
import type { DocState, ToolId } from "./useReader";
import styles from "./PenSettings.module.css";

const NAMES: Record<ToolId, string> = {
  pen: "Pen",
  hl: "Highlighter",
  laser: "Laser pointer",
  eraser: "Eraser",
};

/**
 * A tool's settings, opened by tapping the tool again as on the slide toolbar. The same colours,
 * sizes and limits as there, saved to the same settings, so a presentation and a PDF share them.
 */
export function PenSettings({
  tool,
  anchor,
  state,
  onSet,
  onClose,
}: {
  tool: ToolId | null;
  anchor: HTMLElement | null;
  state: DocState;
  onSet: (tool: ToolId, patch: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({ left: 0, top: 0 });
  const [picking, setPicking] = useState(false);
  const pop = useSpring("spatialFast");
  const fade = useSpring("effectsFast");

  useLayoutEffect(() => {
    if (!anchor || !tool) return;
    const r = anchor.getBoundingClientRect();
    const width = box.current?.offsetWidth ?? 300;
    setPlace({
      left: Math.max(12, Math.min(innerWidth - width - 12, r.left + r.width / 2 - width / 2)),
      top: r.bottom + 10,
    });
  }, [anchor, tool]);

  useEffect(() => {
    if (!tool) return;
    const away = (e: PointerEvent) => {
      const inside = box.current?.contains(e.target as Node) || anchor?.contains(e.target as Node);
      if (!inside && !picking) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !picking) onClose();
    };
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", esc);
    };
  }, [tool, anchor, picking, onClose]);

  const cfg = tool ? state.cfg[tool] : null;
  const colours = tool && state.col[tool] ? [...state.col[tool], ...(cfg?.cust ?? [])] : [];
  const range = tool ? state.rng[tool] : [1, 40, 1];

  return createPortal(
    <AnimatePresence>
      {tool && cfg && (
        <motion.div
          ref={box}
          className={styles.place}
          style={place}
          initial={{ opacity: 0, scale: 0.9, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: { default: pop, opacity: fade } }}
          exit={{ opacity: 0, scale: 0.94, y: -6, transition: fade }}
        >
          <Surface
            material="glass"
            floating
            className={styles.panel}
            role="dialog"
            aria-label={`${NAMES[tool]} settings`}
          >
            <div className={styles.head}>
              <span className={styles.title}>{NAMES[tool]}</span>
              <Button variant="text" size="small" onClick={() => onSet(tool, { reset: true })}>
                Reset
              </Button>
            </div>
            {colours.length > 0 && (
              <div className={styles.colours}>
                <ColorSwatches
                  label="Colour"
                  colors={colours}
                  value={cfg.c ?? ""}
                  onChange={(c) => onSet(tool, { c })}
                />
                <Button
                  variant="tonal"
                  size="small"
                  icon="colorize"
                  onClick={() => setPicking(true)}
                >
                  Any colour
                </Button>
              </div>
            )}
            <Slider
              label="Size"
              min={range[0]}
              max={range[1]}
              step={range[2]}
              value={cfg.w}
              onChange={(w) => onSet(tool, { w })}
            />
            {tool === "hl" && (
              <Slider
                label="Strength"
                min={15}
                max={85}
                value={Math.round((cfg.op ?? 0.42) * 100)}
                format={(v) => `${v}%`}
                onChange={(v) => onSet(tool, { op: v / 100 })}
              />
            )}
            {tool === "laser" && (
              <Slider
                label="Trail length"
                min={300}
                max={4000}
                step={100}
                value={cfg.life ?? 1500}
                format={(v) => `${(v / 1000).toFixed(1)} s`}
                onChange={(life) => onSet(tool, { life })}
              />
            )}
            {tool === "pen" && (
              <Switch
                label="Pressure sensitive"
                description="With a stylus, pressing harder draws thicker."
                checked={cfg.press !== false}
                onCheckedChange={(press) => onSet(tool, { press })}
              />
            )}
          </Surface>
          <Dialog
            open={picking}
            onClose={() => setPicking(false)}
            headline={`${NAMES[tool]} colour`}
            material="glass"
            actions={
              <Button size="medium" onClick={() => setPicking(false)}>
                Done
              </Button>
            }
          >
            <ColorPicker
              value={cfg.c ?? "#000000"}
              onChange={(c) => onSet(tool, { c, custom: true })}
            />
          </Dialog>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
