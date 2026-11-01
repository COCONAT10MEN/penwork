import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  /**
   * "above": the actions rise out of a corner FAB. "side": the FAB sits in the navigation rail
   * and they open out to its right, over the page.
   */
  placement?: "above" | "side";
}

// Each action opens sideways out of its edge, as Google widens them. The room past the edges
// keeps the shadow, which a clip would otherwise cut off.
const OPEN_EDGE = "inset(-30px -30px -30px -30px round 28px)";
const CLOSED_FROM_LEFT = "inset(-30px 150px -30px -30px round 28px)";
const CLOSED_FROM_RIGHT = "inset(-30px -30px -30px 150px round 28px)";

/**
 * M3 Expressive FAB menu. The FAB turns into a round close button and the actions grow out
 * of it one after another, nearest first. Arrow keys move between actions; Escape or a click outside closes it.
 */
export function FabMenu({ label, icon = "add", items, placement = "above" }: FabMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const spring = useSpring("spatialFast");
  const fade = useSpring("effectsFast");
  const reduce = useReduceMotion();
  const side = placement === "side";
  // In the rail the list leaves the rail's box, so it's placed on the page beside the FAB.
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null);
  const closedEdge = side ? CLOSED_FROM_LEFT : CLOSED_FROM_RIGHT;

  useLayoutEffect(() => {
    if (!open || !side || !toggle.current) return;
    const box = toggle.current.getBoundingClientRect();
    setSpot({ left: box.right + 28, top: box.top });
  }, [open, side]);

  useEffect(() => {
    if (!open) return;
    focusFirstItem(list.current);
    const onPointer = (e: PointerEvent) => {
      const on = e.target as Node;
      if (!root.current?.contains(on) && !list.current?.contains(on)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) toggle.current?.focus();
  };

  const actions = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={list}
          id={menuId}
          role="menu"
          aria-label={label}
          className={cx(styles.list, side && styles.sideList)}
          style={side ? (spot ?? { visibility: "hidden" }) : undefined}
          onKeyDown={(e) => {
            if (handleMenuKeys(e, list.current)) return;
            // Like a menu: Tab leaves it and closes it instead of walking through the items.
            if (e.key === "Tab") close(false);
          }}
          exit={{ opacity: 0, transition: fade }}
        >
          {items.map((item, i) => {
            // Bottom item appears first, so the stack grows out of the FAB.
            const order = items.length - 1 - i;
            const button = (
              <motion.button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={item.disabled || undefined}
                className={cx("pw-state", styles.item)}
                initial={reduce ? { opacity: 0 } : { opacity: 0, clipPath: closedEdge }}
                animate={{
                  opacity: 1,
                  clipPath: OPEN_EDGE,
                  transition: {
                    default: { ...spring, delay: order * 0.05 },
                    opacity: { ...fade, delay: order * 0.05 },
                  },
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
  );

  return (
    <div
      ref={root}
      className={styles.root}
      data-side={side || undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close(true);
        }
      }}
      onBlur={(e) => {
        const to = e.relatedTarget as Node | null;
        if (open && !root.current?.contains(to) && !list.current?.contains(to)) setOpen(false);
      }}
    >
      {side ? createPortal(actions, document.body) : actions}
      <Tooltip text={open ? "Close" : label} describes={false} placement={side ? "right" : "left"}>
        <button
          ref={toggle}
          type="button"
          aria-label={open ? `Close ${label.toLowerCase()} menu` : label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          data-open={open || undefined}
          className={cx("pw-state pw-press", styles.fab)}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name={open ? "close" : icon} size={open ? 24 : 28} />
        </button>
      </Tooltip>
    </div>
  );
}
