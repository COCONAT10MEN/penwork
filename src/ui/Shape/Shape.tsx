import { animate } from "motion/react";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { cx } from "../cx";
import { morphBetween, shapePath, type ShapeName } from "../shapes";
import styles from "./Shape.module.css";

export interface ShapeProps {
  /** Change it and the shape morphs across on Material's spring. */
  name: ShapeName;
  /** Starts as this shape and morphs into `name` as soon as it appears. */
  from?: ShapeName;
  size?: number;
  /** Tint, or the whole fill with `solid`. Defaults to the primary colour. */
  color?: string;
  /** A plain colour, for a swatch or a jewel on glass. Otherwise it's tinted glass. */
  solid?: boolean;
  /** Turns slowly, for a large decorative shape. */
  spin?: boolean;
  className?: string;
  /** Sits in the middle, and doesn't turn with the shape. */
  children?: ReactNode;
}

/**
 * An Expressive shape as tinted liquid glass: see-through colour, a sheen across the top and a lit
 * rim. It has no backdrop blur of its own, as it usually sits on a glass surface already.
 */
export function Shape({
  name,
  from,
  size = 64,
  color,
  solid,
  spin,
  className,
  children,
}: ShapeProps) {
  const id = useId();
  const path = useRef<SVGPathElement>(null);
  const [first] = useState(() => shapePath(from ?? name));
  const shown = useRef<ShapeName>(from ?? name);
  const spring = useSpring("spatialDefault");
  const reduce = useReduceMotion();

  useEffect(() => {
    const el = path.current;
    const start = shown.current;
    shown.current = name;
    if (!el || start === name) return;
    if (reduce) {
      el.setAttribute("d", shapePath(name));
      return;
    }
    const between = morphBetween(start, name);
    const morph = animate(0, 1, { ...spring, onUpdate: (t) => el.setAttribute("d", between(t)) });
    return () => morph.stop();
  }, [name, reduce, spring]);

  const box = { width: size, height: size, "--pw-shape-color": color } as CSSProperties;
  return (
    <span className={cx(styles.shape, solid && styles.solid, className)} style={box}>
      <svg viewBox="0 0 100 100" aria-hidden="true" className={spin ? styles.spin : undefined}>
        <defs>
          <path ref={path} id={`${id}-p`} d={first} />
          <linearGradient id={`${id}-s`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className={styles.light} stopOpacity="0.3" />
            <stop offset="0.55" className={styles.light} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-r`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" className={styles.light} stopOpacity="0.85" />
            <stop offset="0.5" className={styles.light} stopOpacity="0.12" />
            <stop offset="1" className={styles.light} stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <use href={`#${id}-p`} className={styles.fill} />
        <use href={`#${id}-p`} fill={`url(#${id}-s)`} />
        <use href={`#${id}-p`} fill="none" stroke={`url(#${id}-r)`} className={styles.rim} />
      </svg>
      {children && <span className={styles.content}>{children}</span>}
    </span>
  );
}
