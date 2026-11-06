/**
 * The shapes the Shapes tool draws, as SVG paths in a box w × h with y going down (how pdf-lib's
 * drawSvgPath reads them). Lines and arrows run from the box's top-left to its bottom-right; the
 * drag's direction flips them.
 */

export interface ShapeDef {
  id: string;
  label: string;
  /** Only an outline: lines and arrows, which have no inside to fill. */
  open?: boolean;
  path: (w: number, h: number) => string;
}

const f = (n: number) => +n.toFixed(2);
const pts = (list: [number, number][]) =>
  `M ${list.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L ")} Z`;

/** A regular polygon or star fitted to the box, its first point at the top. */
function around(n: number, w: number, h: number, inner?: number): string {
  const list: [number, number][] = [];
  const count = inner ? n * 2 : n;
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    const r = inner && i % 2 ? inner : 1;
    list.push([w / 2 + (Math.cos(a) * r * w) / 2, h / 2 + (Math.sin(a) * r * h) / 2]);
  }
  return pts(list);
}

/** An ellipse from four curves (the usual 0.5523 handles). */
function oval(x: number, y: number, w: number, h: number): string {
  const k = 0.5523;
  const [cx, cy, rx, ry] = [x + w / 2, y + h / 2, w / 2, h / 2];
  return [
    `M ${f(cx)} ${f(y)}`,
    `C ${f(cx + k * rx)} ${f(y)} ${f(x + w)} ${f(cy - k * ry)} ${f(x + w)} ${f(cy)}`,
    `C ${f(x + w)} ${f(cy + k * ry)} ${f(cx + k * rx)} ${f(y + h)} ${f(cx)} ${f(y + h)}`,
    `C ${f(cx - k * rx)} ${f(y + h)} ${f(x)} ${f(cy + k * ry)} ${f(x)} ${f(cy)}`,
    `C ${f(x)} ${f(cy - k * ry)} ${f(cx - k * rx)} ${f(y)} ${f(cx)} ${f(y)} Z`,
  ].join(" ");
}

function rounded(w: number, h: number): string {
  const r = Math.min(w, h) * 0.18;
  const k = r * 0.4477;
  return [
    `M ${f(r)} 0 L ${f(w - r)} 0 C ${f(w - k)} 0 ${f(w)} ${f(k)} ${f(w)} ${f(r)}`,
    `L ${f(w)} ${f(h - r)} C ${f(w)} ${f(h - k)} ${f(w - k)} ${f(h)} ${f(w - r)} ${f(h)}`,
    `L ${f(r)} ${f(h)} C ${f(k)} ${f(h)} 0 ${f(h - k)} 0 ${f(h - r)}`,
    `L 0 ${f(r)} C 0 ${f(k)} ${f(k)} 0 ${f(r)} 0 Z`,
  ].join(" ");
}

/** An arrowhead at (x, y), pointing the way from (fx, fy). */
function head(fx: number, fy: number, x: number, y: number, size: number): string {
  const a = Math.atan2(y - fy, x - fx);
  const side = (d: number): [number, number] => [
    x - size * Math.cos(a + d),
    y - size * Math.sin(a + d),
  ];
  return pts([[x, y], side(0.45), side(-0.45)]);
}

export const SHAPES: ShapeDef[] = [
  {
    id: "rect",
    label: "Rectangle",
    path: (w, h) =>
      pts([
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ]),
  },
  { id: "rounded", label: "Rounded", path: rounded },
  { id: "oval", label: "Oval", path: (w, h) => oval(0, 0, w, h) },
  {
    id: "triangle",
    label: "Triangle",
    path: (w, h) =>
      pts([
        [w / 2, 0],
        [w, h],
        [0, h],
      ]),
  },
  {
    id: "right",
    label: "Right triangle",
    path: (w, h) =>
      pts([
        [0, 0],
        [w, h],
        [0, h],
      ]),
  },
  {
    id: "diamond",
    label: "Diamond",
    path: (w, h) =>
      pts([
        [w / 2, 0],
        [w, h / 2],
        [w / 2, h],
        [0, h / 2],
      ]),
  },
  { id: "pentagon", label: "Pentagon", path: (w, h) => around(5, w, h) },
  { id: "hexagon", label: "Hexagon", path: (w, h) => around(6, w, h) },
  { id: "star", label: "Star", path: (w, h) => around(5, w, h, 0.42) },
  {
    id: "heart",
    label: "Heart",
    path: (w, h) =>
      `M ${f(w / 2)} ${f(h)} C ${f(w * 0.1)} ${f(h * 0.7)} 0 ${f(h * 0.45)} 0 ${f(h * 0.28)} ` +
      `C 0 ${f(h * 0.08)} ${f(w * 0.16)} 0 ${f(w * 0.3)} 0 C ${f(w * 0.4)} 0 ${f(w * 0.48)} ${f(h * 0.08)} ${f(w / 2)} ${f(h * 0.18)} ` +
      `C ${f(w * 0.52)} ${f(h * 0.08)} ${f(w * 0.6)} 0 ${f(w * 0.7)} 0 C ${f(w * 0.84)} 0 ${f(w)} ${f(h * 0.08)} ${f(w)} ${f(h * 0.28)} ` +
      `C ${f(w)} ${f(h * 0.45)} ${f(w * 0.9)} ${f(h * 0.7)} ${f(w / 2)} ${f(h)} Z`,
  },
  {
    id: "bubble",
    label: "Speech bubble",
    path: (w, h) =>
      pts([
        [0, 0],
        [w, 0],
        [w, h * 0.75],
        [w * 0.4, h * 0.75],
        [w * 0.18, h],
        [w * 0.22, h * 0.75],
        [0, h * 0.75],
      ]),
  },
  {
    id: "check",
    label: "Tick",
    open: true,
    path: (w, h) => `M 0 ${f(h * 0.55)} L ${f(w * 0.38)} ${f(h)} L ${f(w)} 0`,
  },
  {
    id: "cross",
    label: "Cross",
    open: true,
    path: (w, h) => `M 0 0 L ${f(w)} ${f(h)} M ${f(w)} 0 L 0 ${f(h)}`,
  },
  { id: "line", label: "Line", open: true, path: (w, h) => `M 0 0 L ${f(w)} ${f(h)}` },
  { id: "arrow", label: "Arrow", open: true, path: (w, h) => `M 0 0 L ${f(w)} ${f(h)}` },
  { id: "double", label: "Double arrow", open: true, path: (w, h) => `M 0 0 L ${f(w)} ${f(h)}` },
];

/** The filled heads an arrow gets, for a line of this width. */
export function arrowHeads(id: string, w: number, h: number, width: number): string[] {
  const size = Math.max(8, width * 4);
  if (id === "arrow") return [head(0, 0, w, h, size)];
  if (id === "double") return [head(0, 0, w, h, size), head(w, h, 0, 0, size)];
  return [];
}

/** A small picture of the shape, for the picker and while placing. */
export function shapeSvg(id: string, w = 40, h = 40): string {
  const def = SHAPES.find((s) => s.id === id) ?? SHAPES[0];
  if (!def) return "";
  const pad = 3;
  const body = def.path(w - pad * 2, h - pad * 2);
  const heads = arrowHeads(def.id, w - pad * 2, h - pad * 2, 1.5)
    .map((d) => `<path d="${d}" fill="currentColor"/>`)
    .join("");
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${pad} ${pad})"><path d="${body}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${heads}</g></svg>`;
}
