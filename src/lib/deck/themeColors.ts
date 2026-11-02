/** A presentation's colours, as its theme.css sets them (AI-GUIDE §10). */
export interface ThemeColors {
  teal: string;
  or: string;
  ink: string;
  paper: string;
}

const DEFAULTS: ThemeColors = { teal: "#0aa0c8", or: "#c0562f", ink: "#0b2a36", paper: "#f4f9fb" };
const START = "/* colours from Penwork */";
const END = "/* end of colours from Penwork */";

function readVar(css: string, name: string, fallback: string): string {
  return css.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? fallback;
}

export function readThemeColors(css: string): ThemeColors {
  return {
    teal: readVar(css, "teal", DEFAULTS.teal),
    or: readVar(css, "or", DEFAULTS.or),
    ink: readVar(css, "ink", DEFAULTS.ink),
    paper: readVar(css, "paper", DEFAULTS.paper),
  };
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function darker(hex: string, by: number): string {
  const part = (c: number) =>
    Math.round(c * by)
      .toString(16)
      .padStart(2, "0");
  return `#${rgb(hex).map(part).join("")}`;
}

/** The background blobs and the badge are drawn from the accents, so they follow them. */
function followers({ teal, or }: ThemeColors): string {
  const glow = (hex: string, strong: number) => {
    const [r, g, b] = rgb(hex);
    return `radial-gradient(circle at 40% 40%,rgba(${r},${g},${b},${strong}),rgba(${r},${g},${b},.03) 65%,transparent 72%)`;
  };
  return [
    `.b0{background:${glow(teal, 0.16)}}`,
    `.b1{background:${glow(or, 0.12)}}`,
    `.b2{background:${glow(teal, 0.12)}}`,
    `.b3{background:${glow(or, 0.1)}}`,
    `.sdot{background:radial-gradient(circle at 35% 28%,${teal} 0,${darker(teal, 0.55)} 55%,${darker(teal, 0.2)} 100%)}`,
  ].join("\n");
}

function setVar(css: string, name: string, value: string): string {
  const line = new RegExp(`(--${name}\\s*:\\s*)#[0-9a-fA-F]{3,8}`);
  if (line.test(css)) return css.replace(line, `$1${value}`);
  const root = /:root\s*\{/;
  return root.test(css)
    ? css.replace(root, `:root{--${name}:${value};`)
    : `:root{--${name}:${value}}\n${css}`;
}

/** Changes only the colours, so whatever else the presentation's CSS does is left alone. */
export function setThemeColors(css: string, colors: ThemeColors): string {
  let next = css;
  for (const name of ["teal", "or", "ink", "paper"] as const) {
    next = setVar(next, name, colors[name]);
  }
  const start = next.indexOf(START);
  const end = next.indexOf(END);
  if (start >= 0 && end > start) next = next.slice(0, start) + next.slice(end + END.length);
  return `${next.trimEnd()}\n${START}\n${followers(colors)}\n${END}\n`;
}
