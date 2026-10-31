import { useId } from "react";
import { COOKIE_PATH } from "../shapes";
import styles from "./Logo.module.css";

/**
 * The Penwork mark: a cookie shape with a pen stroke cut out of it. One color (currentColor),
 * so the dock can swap it with its background (DESIGN-GLASS §8).
 */
export function PenworkLogo({
  size = 40,
  label,
  svg,
}: {
  size?: number;
  label?: string;
  /** A custom logo, already checked and cleaned by lib/logo. Replaces the cookie. */
  svg?: string | null;
}) {
  const mask = useId();
  if (svg) {
    return (
      <span
        className={styles.custom}
        style={{ width: size, height: size }}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <mask id={mask}>
        <rect width="100" height="100" fill="white" />
        <path
          d="M32 66c8-3 13-10 18-20s10-16 20-18"
          fill="none"
          stroke="black"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </mask>
      <path d={COOKIE_PATH} fill="currentColor" mask={`url(#${mask})`} />
    </svg>
  );
}

/**
 * The logo on its background, as it sits at the top of the rail and on the closed dock. Both
 * colours belong to the app, not the file, so they are CSS variables set from Settings.
 */
export function LogoTile({
  size = 52,
  label,
  svg,
}: {
  size?: number;
  label?: string;
  svg?: string | null;
}) {
  return (
    <span className={styles.tile} style={{ width: size, height: size }}>
      <PenworkLogo size={Math.round(size * 0.72)} label={label} svg={svg} />
    </span>
  );
}
