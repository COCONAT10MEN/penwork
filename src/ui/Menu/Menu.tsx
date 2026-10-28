import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { cx } from "../cx";
import { focusFirstItem, handleMenuKeys, portalTarget } from "../focus";
import { Icon } from "../Icon";
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
}

const GAP = 4;

/** M3 menu in a portal. Arrow keys, Home/End, Enter; Escape, Tab or a click outside closes. */
export function Menu({ open, onClose, anchor, label, items }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; up: boolean } | null>(null);
  const spring = useSpring("spatialDefault");
  const fade = useSpring("effectsFast");
  const reduce = useReduceMotion();

  useLayoutEffect(() => {
    if (!open || !anchor || !ref.current) return;
    const a = anchor.getBoundingClientRect();
    const m = ref.current.getBoundingClientRect();
    const up = a.bottom + GAP + m.height > window.innerHeight && a.top - GAP - m.height > 0;
    const left = Math.min(Math.max(8, a.left), window.innerWidth - m.width - 8);
    setPos({ left, top: up ? a.top - GAP - m.height : a.bottom + GAP, up });
  }, [open, anchor, items.length]);

  // The position is recomputed in the layout effect above before each opening is painted.
  useEffect(() => {
    if (!open) return;
    focusFirstItem(ref.current);
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor?.contains(t)) onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, anchor, onClose]);

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
          className={styles.menu}
          style={
            pos
              ? { left: pos.left, top: pos.top, transformOrigin: pos.up ? "bottom" : "top" }
              : { visibility: "hidden" }
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
