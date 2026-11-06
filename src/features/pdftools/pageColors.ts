/** Colours read off a page as drawn: for covering words in the paper's own colour. */

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** The paper's colour just around the words, and the darkest-against-it colour inside them. */
export function sampleColors(page: HTMLElement, box: DOMRect): { paper: string; ink: string } {
  const canvas = page.querySelector("canvas");
  const ctx = canvas?.getContext("2d", { willReadFrequently: true });
  if (!canvas || !ctx) return { paper: "#ffffff", ink: "#000000" };
  const c = canvas.getBoundingClientRect();
  const k = canvas.width / c.width;
  const read = (x: number, y: number, w: number, h: number) =>
    ctx.getImageData(
      Math.max(0, Math.round((x - c.left) * k)),
      Math.max(0, Math.round((y - c.top) * k)),
      Math.max(1, Math.round(w * k)),
      Math.max(1, Math.round(h * k)),
    ).data;
  // Above and below the words: the colour seen most is the paper, whatever else crosses the edge.
  const counts = new Map<number, number>();
  const strips = [
    read(box.left - 3, box.top - 3, box.width + 6, 2),
    read(box.left - 3, box.bottom + 1, box.width + 6, 2),
  ];
  for (const strip of strips)
    for (let i = 0; i < strip.length; i += 4) {
      const key =
        (((strip[i] ?? 0) >> 3) << 10) |
        (((strip[i + 1] ?? 0) >> 3) << 5) |
        ((strip[i + 2] ?? 0) >> 3);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  const common = [...counts].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 0x7fff;
  // Back from 5 bits a channel to 8 (31 × 8.226 ≈ 255).
  const paper = [
    ((common >> 10) & 31) * 8.226,
    ((common >> 5) & 31) * 8.226,
    (common & 31) * 8.226,
  ] as const;
  const inside = read(box.left, box.top, box.width, box.height);
  let best = 0;
  let ink: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < inside.length; i += 4) {
    const px: [number, number, number] = [inside[i] ?? 0, inside[i + 1] ?? 0, inside[i + 2] ?? 0];
    const d = Math.abs(px[0] - paper[0]) + Math.abs(px[1] - paper[1]) + Math.abs(px[2] - paper[2]);
    if (d > best) {
      best = d;
      ink = px;
    }
  }
  return { paper: hex(...paper), ink: hex(...ink) };
}

/** What pdf.js paints pages with when "Dark pages" is on: data for pdf.js, not app colours. */
export const DARK_PAGE = { background: "#1b1b1f", foreground: "#e4e2e6" };

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
const FG = rgb(DARK_PAGE.foreground);
const BG = rgb(DARK_PAGE.background);

/**
 * A page colour as it's shown. With dark pages pdf.js turns each colour's lightness into a blend
 * from the light ink (for black) to the dark paper (for white), so the same is done here.
 */
export function asShown(color: string, dark: boolean): string {
  if (!dark) return color;
  const [r = 0, g = 0, b = 0] = rgb(color);
  const light = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return hex(...(FG.map((f, i) => f + light * ((BG[i] ?? 0) - f)) as [number, number, number]));
}

/** The other way: a colour read off a dark page back to the grey it is in the file. */
export function asPrinted(seen: string, dark: boolean): string {
  if (!dark) return seen;
  const s = rgb(seen);
  let along = 0;
  let length = 0;
  FG.forEach((f, i) => {
    along += ((s[i] ?? 0) - f) * ((BG[i] ?? 0) - f);
    length += ((BG[i] ?? 0) - f) ** 2;
  });
  const grey = Math.max(0, Math.min(1, along / length)) * 255;
  return hex(grey, grey, grey);
}
