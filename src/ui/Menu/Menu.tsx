import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { cx } from "../cx";
import { focusFirstItem, handleMenuKeys, portalTarget } from "../focus";
import { Icon } from "../Icon";
import { surfaceClass, type SurfaceMaterial } from "../Surface/Surface";
import styles from "./Menu.module.css";

export type MenuEntry =
  | {
      label: string;
      icon?: string;
      /** Right-aligned hint such as a shortcut ("Ctrl+O"). */
      trailing?: string;
      onSelect: () => void;
      disabled?: boolean;
    }
  | "divider";

export interface MenuProps {
  open: boolean;
  onClose: () => void;
  /** The button that opened it: the menu is placed next to it and focus returns to it. */
  anchor: HTMLElement | null;
  label: string;
  items: MenuEntry[];
  /** Glass menus have no blur (DESIGN-GLASS §7): an opaque fill with the rim and sheen. */
  material?: SurfaceMaterial;
}

const GAP = 4;

/** M3 menu in a portal. Arrow keys, Home/End, Enter; Escape, Tab or a click outside closes. */
export function Menu({ open, onClose, anchor, label, items, material = "tonal" }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; up: boolean } | null>(null);
  const spring = useSpring("spatialCalm");
  const fade = useSpring("effectsFast");
  const reduce = useReduceMotion();

  // Kept in a ref: a parent re-render passes a new onClose, which must not re-run the effect
  // below and pull focus back to the first item.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useLayoutEffect(() => {
    if (!open || !anchor || !ref.current) return;
    const a = anchor.getBoundingClientRect();
    // The opening animation has it scaled down right now, so its on-screen box is too small.
    const height = ref.current.offsetHeight;
    const width = ref.current.offsetWidth;
    const up = a.bottom + GAP + height > window.innerHeight && a.top - GAP - height > 0;
    const left = Math.min(Math.max(8, a.left), window.innerWidth - width - 8);
    setPos({ left, top: up ? a.top - GAP - height : a.bottom + GAP, up });
  }, [open, anchor, items.length]);

  // The position is recomputed in the layout effect above before each opening is painted.
  useEffect(() => {
    if (!open) return;
    focusFirstItem(ref.current);
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor?.contains(t)) closeRef.current();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, anchor]);

  const close = (refocus: boolean) => {
    onClose();
    if (refocus) anchor?.focus();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="menu"
          aria-label={label}
          className={cx(
            styles.menu,
            material === "tonal" && styles.tonal,
            surfaceClass({ material, strength: "thick", floating: true, solid: true }),
          )}
          // Until measured it sits off-screen, not visibility:hidden, so the first item can take focus.
          style={
            pos
              ? { left: pos.left, top: pos.top, transformOrigin: pos.up ? "bottom" : "top" }
              : { left: -10000, top: 0 }
          }
          initial={reduce ? { opacity: 0 } : { opacity: 0, scaleY: 0.85 }}
          animate={{ opacity: 1, scaleY: 1, transition: spring }}
          exit={{ opacity: 0, transition: fade }}
          onKeyDown={(e) => {
            if (handleMenuKeys(e, ref.current)) return;
            if (e.key === "Escape") {
              e.stopPropagation();
              close(true);
            } else if (e.key === "Tab") {
              close(false);
            }
          }}
        >
          {items.map((item, i) =>
            item === "divider" ? (
              <div key={`divider-${i}`} role="separator" className={styles.divider} />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={item.disabled || undefined}
                className={cx("pw-state", styles.item)}
                onClick={() => {
                  if (item.disabled) return;
                  close(true);
                  item.onSelect();
                }}
              >
                {item.icon && <Icon name={item.icon} size={20} className={styles.icon} />}
                <span className={styles.label}>{item.label}</span>
                {item.trailing && <span className={styles.trailing}>{item.trailing}</span>}
              </button>
            ),
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    portalTarget(anchor),
  );
}
