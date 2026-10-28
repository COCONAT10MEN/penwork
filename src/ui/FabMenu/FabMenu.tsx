import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { cx } from "../cx";
import { focusFirstItem, handleMenuKeys } from "../focus";
import { Icon } from "../Icon";
import { Tooltip } from "../Tooltip/Tooltip";
import styles from "./FabMenu.module.css";

export interface FabMenuItem {
  icon: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Shown as a tooltip on a disabled item, e.g. "Coming in a later update". */
  disabledReason?: string;
}

export interface FabMenuProps {
  /** Accessible name of the toggle, e.g. "Create". */
  label: string;
  icon?: string;
  items: FabMenuItem[];
}

/**
 * M3 Expressive FAB menu. The FAB turns into a round close button and the actions spring
 * up above it. Arrow keys move between actions; Escape or a click outside closes it.
 */
export function FabMenu({ label, icon = "add", items }: FabMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const spring = useSpring("spatialDefault");
  const reduce = useReduceMotion();

  useEffect(() => {
    if (!open) return;
    focusFirstItem(list.current);
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) toggle.current?.focus();
  };

  return (
    <div
      ref={root}
      className={styles.root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close(true);
        }
      }}
      onBlur={(e) => {
        if (open && !root.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            ref={list}
            id={menuId}
            role="menu"
            aria-label={label}
            className={styles.list}
            onKeyDown={(e) => handleMenuKeys(e, list.current)}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            {items.map((item, i) => {
              // Bottom item appears first, so the stack grows out of the FAB.
              const order = items.length - 1 - i;
              const button = (
                <motion.button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  aria-disabled={item.disabled || undefined}
                  className={cx("pw-state", styles.item)}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.85 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { ...spring, delay: order * 0.03 },
                  }}
                  onClick={() => {
                    if (item.disabled) return;
                    close(false);
                    item.onSelect();
                  }}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </motion.button>
              );
              return item.disabled && item.disabledReason ? (
                <Tooltip key={item.label} text={item.disabledReason} placement="left">
                  {button}
                </Tooltip>
              ) : (
                button
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      <Tooltip text={label} describes={false} placement="left">
        <button
          ref={toggle}
          type="button"
          aria-label={open ? `Close ${label.toLowerCase()} menu` : label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          data-open={open || undefined}
          className={cx("pw-state", styles.fab)}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name={open ? "close" : icon} size={open ? 24 : 28} />
        </button>
      </Tooltip>
    </div>
  );
}
