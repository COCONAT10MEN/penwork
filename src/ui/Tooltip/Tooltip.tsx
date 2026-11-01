import { AnimatePresence, motion } from "motion/react";
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { cx } from "../cx";
import { portalTarget } from "../focus";
import { surfaceClass, type SurfaceMaterial } from "../Surface/Surface";
import styles from "./Tooltip.module.css";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  text: string;
  placement?: TooltipPlacement;
  /**
   * Link the tooltip to the control with aria-describedby. Turn off when the text only repeats
   * the control's own aria-label (icon buttons), or screen readers read it twice.
   */
  describes?: boolean;
  material?: SurfaceMaterial;
  /** A single focusable element. For a disabled control use aria-disabled, not `disabled`. */
  children: ReactElement<{ "aria-describedby"?: string }>;
}

const HOVER_DELAY_MS = 150;
const STAYS_WARM_MS = 400;
const GAP = 8;
// With one just showing, the next control's comes up straight away.
let lastShown = 0;

function position(
  anchor: DOMRect,
  tip: { width: number; height: number },
  placement: TooltipPlacement,
) {
  const centerX = anchor.left + anchor.width / 2 - tip.width / 2;
  const centerY = anchor.top + anchor.height / 2 - tip.height / 2;
  const spots = {
    top: { left: centerX, top: anchor.top - tip.height - GAP },
    bottom: { left: centerX, top: anchor.bottom + GAP },
    left: { left: anchor.left - tip.width - GAP, top: centerY },
    right: { left: anchor.right + GAP, top: centerY },
  };
  let spot = spots[placement];
  // Flip when it would leave the window.
  if (placement === "top" && spot.top < 0) spot = spots.bottom;
  if (placement === "bottom" && spot.top + tip.height > window.innerHeight) spot = spots.top;
  const left = Math.min(Math.max(4, spot.left), window.innerWidth - tip.width - 4);
  // It grows out of the control, even when the window's edge has pushed it to one side.
  const middle = anchor.left + anchor.width / 2 - left;
  const x = placement === "left" ? tip.width : placement === "right" ? 0 : middle;
  const y = spot.top < anchor.top ? tip.height : spot.top >= anchor.bottom ? 0 : tip.height / 2;
  return { left, top: spot.top, transformOrigin: `${x}px ${y}px` };
}

/** Plain M3 tooltip: grows out of its control after a short hover, or at once on keyboard focus. */
export function Tooltip({
  text,
  placement = "top",
  describes = true,
  material = "glass",
  children,
}: TooltipProps) {
  const id = useId();
  const wrapper = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const pop = useSpring("spatialFast");
  const fade = useSpring("effectsFast");
  const reduce = useReduceMotion();
  // Where the tooltip is rendered. Picked when it opens, not during render.
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<ReturnType<typeof position> | null>(null);

  const anchorEl = () => wrapper.current?.firstElementChild ?? null;

  const show = useCallback((delay: number) => {
    window.clearTimeout(timer.current);
    const wait = Date.now() - lastShown < STAYS_WARM_MS ? 0 : delay;
    timer.current = window.setTimeout(() => {
      setTarget(portalTarget(wrapper.current?.firstElementChild ?? null));
      setCoords(null);
      setOpen(true);
    }, wait);
  }, []);
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen((was) => {
      if (was) lastShown = Date.now();
      return false;
    });
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
    };
  }, [open, hide]);

  useLayoutEffect(() => {
    const anchor = anchorEl();
    if (open && anchor && tip.current) {
      // offsetWidth, as the opening animation has it scaled down right now.
      const { offsetWidth: width, offsetHeight: height } = tip.current;
      setCoords(position(anchor.getBoundingClientRect(), { width, height }, placement));
    }
  }, [open, placement, text]);

  // The description must exist while the tooltip is hidden too (e.g. why an item is disabled),
  // so screen readers get an always-present hidden copy; the visible bubble is aria-hidden.
  const descId = `${id}-desc`;
  const child =
    isValidElement(children) && describes
      ? cloneElement(children, { "aria-describedby": descId })
      : children;

  return (
    <>
      <span
        ref={wrapper}
        className={styles.wrapper}
        onPointerEnter={() => show(HOVER_DELAY_MS)}
        onPointerLeave={hide}
        onPointerDown={hide}
        onFocus={(e) => e.target.matches(":focus-visible") && show(0)}
        onBlur={hide}
      >
        {child}
        {describes && (
          <span id={descId} className="pw-visually-hidden">
            {text}
          </span>
        )}
      </span>
      {target &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={tip}
                id={id}
                role="tooltip"
                aria-hidden="true"
                className={cx(
                  styles.tooltip,
                  material === "tonal" && styles.tonal,
                  surfaceClass({ material, strength: "thick", floating: true }),
                )}
                style={coords ?? { visibility: "hidden", left: 0, top: 0 }}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, "--pw-mat": 0 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  "--pw-mat": 1,
                  transition: { default: pop, opacity: fade, "--pw-mat": fade },
                }}
                exit={{ opacity: 0, scale: reduce ? 1 : 0.8, transition: fade }}
              >
                {text}
              </motion.div>
            )}
          </AnimatePresence>,
          target,
        )}
    </>
  );
}
