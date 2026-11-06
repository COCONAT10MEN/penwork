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
