import { hexToRgb } from "./contrast";

/** Color math for the ColorPicker and glass tokens. Hue 0–360, saturation and value 0–1. */

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

function toHex(n: number): string {
  return Math.round(n).toString(16).padStart(2, "0");
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return rgbToHex(f(5), f(3), f(1));
}

/** Mix `amount` (0–1) of `other` into `base`. */
export function mixHex(base: string, other: string, amount: number): string {
  const a = hexToRgb(base);
  const b = hexToRgb(other);
  const mix = (i: 0 | 1 | 2) => a[i] + (b[i] - a[i]) * amount;
  return rgbToHex(mix(0), mix(1), mix(2));
}

/** `rgb(r g b / alpha)` for use in CSS. */
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** Accepts #rgb or #rrggbb, with or without #, and returns #rrggbb, or null if it isn't a color. */
export function normalizeHex(input: string): string | null {
  const s = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`;
  if (/^[0-9a-f]{3}$/.test(s)) return `#${s.replace(/./g, "$&$&")}`;
  return null;
}
