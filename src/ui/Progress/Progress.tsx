import { animate } from "motion/react";
import { useEffect, useRef, type CSSProperties } from "react";
import { springTransition, useReduceMotion } from "../../theme/motion";
import { cx } from "../cx";
import {
  COOKIE_PATH,
  morphBetween,
  shapePath,
  wavyCirclePath,
  wavyLinePath,
  type ShapeName,
} from "../shapes";
import styles from "./Progress.module.css";

interface ProgressBase {
  /** What is loading, for screen readers. */
  label: string;
  /** 0–1. Leave out when the length of the wait is unknown. */
  value?: number;
}

function percent(value: number): number {
  return Math.min(1, Math.max(0, value)) * 100;
}

function ariaValues(value: number | undefined) {
  return value === undefined
    ? {}
    : { "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(percent(value)) };
}

// Longer than any bar, so the wave can scroll one wavelength without showing its end.
const WAVELENGTH = 32;
const WAVE = wavyLinePath(3200, WAVELENGTH, 2, 6);

/** Google keeps the wave flat for the first 10% and the last 5%. */
function amplitude(determinate: boolean, value: number | undefined): number {
  if (!determinate || value === undefined) return 1;
  return value <= 0.1 || value >= 0.95 ? 0 : 1;
}

export interface LinearProgressProps extends ProgressBase {
  /** The M3 Expressive wave on the active part. Flat when off. */
  wavy?: boolean;
}

export function LinearProgress({ label, value, wavy = true }: LinearProgressProps) {
  const determinate = value !== undefined;
  const pct = determinate ? percent(value) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      {...ariaValues(value)}
      className={cx(styles.linear, !determinate && styles.indeterminate)}
      style={{ "--pw-pct": pct, "--pw-amp": amplitude(determinate, value) } as CSSProperties}
    >
      <span className={styles.rest} />
      <span className={styles.stop} />
      <span className={styles.active}>
        {/* The flat line is always there; the wave fades in over it, and out again where Google
            keeps the bar flat (the first 10% and the last 5%). */}
        <span className={styles.flat} />
        {wavy && (
          <svg className={styles.wave} width="3200" height="12" aria-hidden="true">
            <path d={WAVE} />
          </svg>
        )}
      </span>
    </div>
  );
}

export interface CircularProgressProps extends ProgressBase {
  size?: number;
}

export function CircularProgress({ label, value, size = 48 }: CircularProgressProps) {
  const determinate = value !== undefined;
  const pct = determinate ? percent(value) : 28;
  return (
    <svg
      role="progressbar"
      aria-label={label}
      {...ariaValues(value)}
      className={cx(styles.circular, !determinate && styles.spinning)}
      width={size}
      height={size}
      viewBox="0 0 48 48"
    >
      <circle className={styles.circleTrack} cx="24" cy="24" r="19" />
      <path
        className={styles.circleWave}
        d={wavyCirclePath(19, 1.6, 10, 24)}
        pathLength={100}
        strokeDasharray={`${pct} 100`}
      />
    </svg>
  );
}

// Google's sequence and timing (LoadingIndicator.kt).
const SEQUENCE: ShapeName[] = [
  "SoftBurst",
  "Cookie9Sided",
  "Pentagon",
  "Pill",
  "Sunny",
  "Cookie4Sided",
  "Oval",
];
const MORPH_EVERY_MS = 650;
const TURN_PER_MORPH = 90;
// Google counts it as settled early (0.1), or this bouncy spring would hold up the next shape.
const MORPH_SPRING = {
  ...springTransition({ ratio: 0.6, stiffness: 200 }),
  restDelta: 0.1,
  restSpeed: 0.1,
};

/** Shape-morphing wait indicator, for waits of a few seconds or less. */
export function LoadingIndicator({ label, size = 48 }: { label: string; size?: number }) {
  const reduce = useReduceMotion();
  const path = useRef<SVGPathElement>(null);
  const turn = useRef<SVGGElement>(null);

  useEffect(() => {
    const el = path.current;
    const group = turn.current;
    if (reduce || !el || !group) return;
    let alive = true;
    let stop = () => {};
    const run = async () => {
      for (let at = 0; alive; at += 1) {
        const from = SEQUENCE[at % SEQUENCE.length] as ShapeName;
        const to = SEQUENCE[(at + 1) % SEQUENCE.length] as ShapeName;
        const between = morphBetween(from, to);
        const start = at * TURN_PER_MORPH;
        const morph = animate(0, 1, {
          ...MORPH_SPRING,
          onUpdate: (t) => {
            el.setAttribute("d", between(t));
            group.setAttribute("transform", `rotate(${start + t * TURN_PER_MORPH} 50 50)`);
          },
        });
        stop = () => morph.stop();
        // Whichever is longer: the wait, or the spring coming to rest.
        await Promise.all([morph, new Promise((done) => setTimeout(done, MORPH_EVERY_MS))]);
      }
    };
    void run();
    return () => {
      alive = false;
      stop();
    };
  }, [reduce]);

  return (
    <span
      role="progressbar"
      aria-label={label}
      className={styles.loading}
      style={{ width: size, height: size }}
    >
      {reduce ? (
        <svg viewBox="0 0 100 100" className={styles.pulse} aria-hidden="true">
          <path d={COOKIE_PATH} />
        </svg>
      ) : (
        <svg viewBox="-10 -10 120 120" className={styles.turning} aria-hidden="true">
          <g ref={turn}>
            <path ref={path} d={shapePath("SoftBurst")} />
          </g>
        </svg>
      )}
    </span>
  );
}
