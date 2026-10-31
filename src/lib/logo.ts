import DOMPurify from "dompurify";

/** Checks a custom logo against docs/DESIGN-GLASS.md §8 and prepares it for the app to colour. */

export interface LogoResult {
  ok: true;
  /** Cleaned SVG with its colour replaced by currentColor. */
  svg: string;
  color: string;
}
export interface LogoRefusal {
  ok: false;
  message: string;
}

const MAX_BYTES = 200 * 1024;
const IGNORED_PAINT = new Set(["none", "transparent", "currentcolor", "inherit"]);
const FORBIDDEN: [string, string][] = [
  ["script", "scripts"],
  ["foreignObject", "embedded web content"],
  ["image", "embedded images"],
  ["animate", "animation"],
  ["animateTransform", "animation"],
  ["animateMotion", "animation"],
  ["set", "animation"],
  ["text", "live text (convert it to shapes)"],
  ["linearGradient", "more than one colour"],
  ["radialGradient", "more than one colour"],
  ["a", "links"],
];

function normalise(value: string): string {
  const v = value.trim().toLowerCase();
  const short = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const rgb = v.match(/^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/);
  if (rgb) {
    const hex = rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0"));
    return `#${hex.join("")}`;
  }
  return v === "black" ? "#000000" : v === "white" ? "#ffffff" : v;
}

function styleColors(style: string): string[] {
  return Array.from(style.matchAll(/(?:fill|stroke|color)\s*:\s*([^;}]+)/gi), (m) => m[1] ?? "");
}

function isSquare(root: Element): boolean {
  const [x, y, width, height, ...rest] = (root.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const sizes = [x, y, width, height];
  return rest.length === 0 && sizes.every(Number.isFinite) && width === height && (width ?? 0) > 0;
}

/** A rectangle over the whole logo is a painted background, which the app draws itself. */
function hasPaintedBackground(root: Element): boolean {
  const size = (root.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/)[2];
  return Array.from(root.querySelectorAll("rect")).some((rect) => {
    const fill = rect.getAttribute("fill");
    if (fill && IGNORED_PAINT.has(fill.toLowerCase())) return false;
    const covers = (v: string | null) => v === "100%" || (v !== null && v === size);
    return covers(rect.getAttribute("width")) && covers(rect.getAttribute("height"));
  });
}

function usedColors(root: Element): Set<string> {
  const colors = new Set<string>();
  const add = (value: string | null) => {
    if (!value) return;
    const color = normalise(value);
    if (color && !IGNORED_PAINT.has(color) && !color.startsWith("url(")) colors.add(color);
  };
  for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
    if (el.nodeName.toLowerCase() === "style") {
      styleColors(el.textContent ?? "").forEach(add);
      continue;
    }
    add(el.getAttribute("fill"));
    add(el.getAttribute("stroke"));
    styleColors(el.getAttribute("style") ?? "").forEach(add);
  }
  return colors;
}

const COLOR_RULE = /(fill|stroke|color)\s*:\s*[^;}]+/gi;

function swapColor(rule: string): string {
  return /:\s*(none|transparent)/i.test(rule) ? rule : `${rule.split(":")[0]}:currentColor`;
}

function recolour(root: Element): void {
  const paint = (el: Element, name: string) => {
    const value = el.getAttribute(name);
    if (value && !IGNORED_PAINT.has(value.trim().toLowerCase()) && !value.startsWith("url(")) {
      el.setAttribute(name, "currentColor");
    }
  };
  for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
    if (el.nodeName.toLowerCase() === "style") {
      el.textContent = (el.textContent ?? "").replace(COLOR_RULE, (rule) => swapColor(rule));
      continue;
    }
    paint(el, "fill");
    paint(el, "stroke");
    const style = el.getAttribute("style");
    if (style) {
      el.setAttribute(
        "style",
        style.replace(COLOR_RULE, (rule) => swapColor(rule)),
      );
    }
  }
  // Unpainted shapes are black by default in SVG, so the root decides them too.
  if (!root.hasAttribute("fill")) root.setAttribute("fill", "currentColor");
  root.removeAttribute("width");
  root.removeAttribute("height");
}

export function checkLogo(fileName: string, text: string): LogoResult | LogoRefusal {
  const refuse = (message: string): LogoRefusal => ({ ok: false, message });
  if (!fileName.toLowerCase().endsWith(".svg")) {
    return refuse("The logo must be an .svg file, so it stays sharp at any size.");
  }
  if (new TextEncoder().encode(text).length > MAX_BYTES) {
    return refuse("The logo must be 200 KB or smaller.");
  }
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) {
    return refuse("This file isn't a valid SVG.");
  }
  if (!isSquare(root)) return refuse("The logo must be square, with a viewBox like 0 0 100 100.");
  for (const [tag, what] of FORBIDDEN) {
    if (root.getElementsByTagName(tag).length > 0) {
      return refuse(`The logo can't contain ${what}.`);
    }
  }
  if (hasPaintedBackground(root)) {
    return refuse("The logo needs a transparent background. Penwork draws the background itself.");
  }
  const colors = usedColors(root);
  if (colors.size > 1) {
    return refuse("The logo must use one colour, because it swaps with its background.");
  }
  recolour(root);

  const svg = DOMPurify.sanitize(root.outerHTML, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_ATTR: ["href", "xlink:href"],
  });
  if (!svg.includes("<svg")) return refuse("This file isn't a valid SVG.");
  return { ok: true, svg, color: [...colors][0] ?? "#000000" };
}
