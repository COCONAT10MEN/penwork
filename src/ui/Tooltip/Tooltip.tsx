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
import { portalTarget } from "../focus";
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
  /** A single focusable element. For a disabled control use aria-disabled, not `disabled`. */
  children: ReactElement<{ "aria-describedby"?: string }>;
}

const HOVER_DELAY_MS = 500;
const GAP = 8;

function position(anchor: DOMRect, tip: DOMRect, placement: TooltipPlacement) {
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
  return { left, top: spot.top };
}

/** Plain M3 tooltip: shows after a short hover, or right away on keyboard focus. */
export function Tooltip({ text, placement = "top", describes = true, children }: TooltipProps) {
  const id = useId();
  const wrapper = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // Where the tooltip is rendered; null while hidden. Picked when it opens, not during render.
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const open = target !== null;

  const anchorEl = () => wrapper.current?.firstElementChild ?? null;

  const show = useCallback((delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setTarget(portalTarget(wrapper.current?.firstElementChild ?? null));
    }, delay);
  }, []);
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setTarget(null);
    setCoords(null);
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
      setCoords(
        position(anchor.getBoundingClientRect(), tip.current.getBoundingClientRect(), placement),
      );
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
          <div
            ref={tip}
            id={id}
            role="tooltip"
            aria-hidden="true"
            className={styles.tooltip}
            style={coords ?? { visibility: "hidden", left: 0, top: 0 }}
          >
            {text}
          </div>,
          target,
        )}
    </>
  );
}
