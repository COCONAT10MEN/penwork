import { useId } from "react";
import { COOKIE_PATH } from "../shapes";

/**
 * The Penwork mark: a cookie shape with a pen stroke cut out of it. One color (currentColor),
 * so the dock can swap it with its background (DESIGN-GLASS §8).
 */
export function PenworkLogo({ size = 40, label }: { size?: number; label?: string }) {
  const mask = useId();
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
