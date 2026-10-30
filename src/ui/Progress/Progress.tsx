import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { useReduceMotion } from "../../theme/motion";
import { cx } from "../cx";
import {
  CIRCLE_PATH,
  CLOVER_PATH,
  COOKIE_PATH,
  scallopPath,
  wavyCirclePath,
  wavyLinePath,
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
      style={{ "--pw-pct": pct } as CSSProperties}
    >
      <span className={styles.rest} />
      <span className={styles.stop} />
      <span className={styles.active}>
        {wavy ? (
          <svg className={styles.wave} width="3200" height="12" aria-hidden="true">
            <path d={WAVE} />
          </svg>
        ) : (
          <span className={styles.flat} />
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

const MORPH = [COOKIE_PATH, CLOVER_PATH, scallopPath(5, 0.14), scallopPath(12, 0.05), CIRCLE_PATH];

/** Shape-morphing wait indicator, for waits of a few seconds or less. */
export function LoadingIndicator({ label, size = 48 }: { label: string; size?: number }) {
  const reduce = useReduceMotion();
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
        <motion.svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          animate={{ rotate: 360 }}
          transition={{ duration: 6, ease: "linear", repeat: Infinity }}
        >
          <motion.path
            animate={{ d: [...MORPH, MORPH[0] as string] }}
            transition={{ duration: 5, ease: "easeInOut", repeat: Infinity }}
          />
        </motion.svg>
      )}
    </span>
  );
}
