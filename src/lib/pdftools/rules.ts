/**
 * The straight lines a page draws (a table's borders, rules under headings) and its filled boxes
 * (a shaded header row), read from pdf.js's list of drawing instructions; and the grids those lines
 * make. A table drawn with lines is read from its lines: where the words sit between them says
 * which cell they're in, however tight the columns are.
 */

type M = [number, number, number, number, number, number];
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const matrix = (a: unknown): M => {
  const v = Array.isArray(a) || ArrayBuffer.isView(a) ? Array.from(a as ArrayLike<number>) : [];
  return [v[0] ?? 1, v[1] ?? 0, v[2] ?? 0, v[3] ?? 1, v[4] ?? 0, v[5] ?? 0];
};

/** A straight line across or down the page, in points from the top-left. */
export interface Rule {
  /** Across (x0 to x1 at y) or down (y0 to y1 at x). */
  across: boolean;
  /** Where it is: y for a line across, x for a line down. */
  at: number;
  from: number;
  to: number;
  thickness: number;
  /** "#rrggbb". */
  color: string;
}

/** A filled box, in points from the top-left. */
export interface Fill {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
}

/** Thinner than this, a filled box is a line. */
const THIN = 2.5;
/** Shorter than this, a line is a mark, not a rule. */
const SHORT = 4;

/**
 * The page's straight lines and filled boxes, from pdf.js's drawing instructions. `toView` turns
 * the PDF's points (from the bottom-left) into the page's (from the top-left).
 */
export function rulesOf(
  fnArray: ArrayLike<number>,
  argsArray: ArrayLike<unknown>,
  OPS: Record<string, number>,
  toView: (x: number, y: number) => number[],
): { rules: Rule[]; fills: Fill[] } {
  const rules: Rule[] = [];
  const fills: Fill[] = [];
  let ctm: M = [1, 0, 0, 1, 0, 0];
  let fill = "#000000";
  let stroke = "#000000";
  let lineWidth = 1;
  const stack: { ctm: M; fill: string; stroke: string; lineWidth: number }[] = [];
  const strokes = new Set([
    OPS.stroke,
    OPS.closeStroke,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
  ]);
  const fillsOps = new Set([
    OPS.fill,
    OPS.eoFill,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
  ]);
  const view = (x: number, y: number) => {
    const [vx = 0, vy = 0] = toView(
      ctm[0] * x + ctm[2] * y + ctm[4],
      ctm[1] * x + ctm[3] * y + ctm[5],
    );
    return [vx, vy] as const;
  };
  const line = (
    a: readonly [number, number],
    b: readonly [number, number],
    thick: number,
    color: string,
  ) => {
    const dx = Math.abs(a[0] - b[0]);
    const dy = Math.abs(a[1] - b[1]);
    if (dy < 0.5 && dx >= SHORT)
      rules.push({
        across: true,
        at: (a[1] + b[1]) / 2,
        from: Math.min(a[0], b[0]),
        to: Math.max(a[0], b[0]),
        thickness: thick,
        color,
      });
    else if (dx < 0.5 && dy >= SHORT)
      rules.push({
        across: false,
        at: (a[0] + b[0]) / 2,
        from: Math.min(a[1], b[1]),
        to: Math.max(a[1], b[1]),
        thickness: thick,
        color,
      });
  };
  const paint = (op: number, data: ArrayLike<number>) => {
    const doStroke = strokes.has(op);
    const doFill = fillsOps.has(op);
    if (!doStroke && !doFill) return;
    // Its pieces: each a list of corners, or null when it curves.
    const paths: { pts: (readonly [number, number])[]; closed: boolean; curved: boolean }[] = [];
    let cur: (typeof paths)[number] | null = null;
    for (let i = 0; i < data.length;) {
      const code = data[i++];
      if (code === 0) {
        cur = { pts: [view(Number(data[i]), Number(data[i + 1]))], closed: false, curved: false };
        paths.push(cur);
        i += 2;
      } else if (code === 1) {
        cur?.pts.push(view(Number(data[i]), Number(data[i + 1])));
        i += 2;
      } else if (code === 2) {
        if (cur) cur.curved = true;
        i += 6;
      } else if (code === 3) {
        if (cur) cur.curved = true;
        i += 4;
      } else if (code === 4) {
        if (cur) cur.closed = true;
      } else break;
    }
    const scale = Math.sqrt(Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2])) || 1;
    for (const p of paths) {
      if (p.curved || p.pts.length < 2) continue;
      const xs = p.pts.map((q) => q[0]);
      const ys = p.pts.map((q) => q[1]);
      const x0 = Math.min(...xs);
      const x1 = Math.max(...xs);
      const y0 = Math.min(...ys);
      const y1 = Math.max(...ys);
      const box =
        p.pts.length >= 4 &&
        p.pts.every(
          (q) =>
            (Math.abs(q[0] - x0) < 0.3 || Math.abs(q[0] - x1) < 0.3) &&
            (Math.abs(q[1] - y0) < 0.3 || Math.abs(q[1] - y1) < 0.3),
        );
      if (doFill && box) {
        const w = x1 - x0;
        const h = y1 - y0;
        if (h <= THIN && w >= SHORT) line([x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2], h, fill);
        else if (w <= THIN && h >= SHORT) line([(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1], w, fill);
        else if (w >= SHORT && h >= SHORT) fills.push({ x0, y0, x1, y1, color: fill });
      }
      if (doStroke) {
        const pts = p.closed ? [...p.pts, p.pts[0] as readonly [number, number]] : p.pts;
        for (let k = 1; k < pts.length; k++)
          line(
            pts[k - 1] as readonly [number, number],
            pts[k] as readonly [number, number],
            lineWidth * scale,
            stroke,
          );
      }
    }
  };
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = (argsArray[i] ?? []) as unknown[];
    if (fn === OPS.save) stack.push({ ctm, fill, stroke, lineWidth });
    else if (fn === OPS.restore) {
      const s = stack.pop();
      if (s) ({ ctm, fill, stroke, lineWidth } = s);
    } else if (fn === OPS.transform) ctm = mul(ctm, matrix(args));
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push({ ctm, fill, stroke, lineWidth });
      if (args[0]) ctm = mul(ctm, matrix(args[0]));
    } else if (fn === OPS.paintFormXObjectEnd) {
      const s = stack.pop();
      if (s) ({ ctm, fill, stroke, lineWidth } = s);
    } else if (fn === OPS.setFillRGBColor && typeof args[0] === "string") fill = args[0];
    else if (fn === OPS.setStrokeRGBColor && typeof args[0] === "string") stroke = args[0];
    else if (fn === OPS.setLineWidth) lineWidth = Number(args[0]) || 1;
    else if (fn === OPS.constructPath) {
      const data = (args[1] as unknown[] | undefined)?.[0];
      if (data && (Array.isArray(data) || ArrayBuffer.isView(data)))
        paint(Number(args[0]), data as ArrayLike<number>);
    }
  }
  return { rules, fills };
}

/** A table's grid: where its lines down and across are, and how they're drawn. */
export interface Grid {
  /** Left to right: the column edges. */
  xs: number[];
  /** Top to bottom: the row edges. */
  ys: number[];
  thickness: number;
  color: string;
}

/** Values within `tol` of each other as one, in order. */
function cluster(values: number[], tol: number): number[] {
  const out: number[][] = [];
  for (const v of [...values].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && v - (last[last.length - 1] as number) <= tol) last.push(v);
    else out.push([v]);
  }
  return out.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
}

/**
 * The grids the page's lines make: lines across and down that cross, two columns or more. A box
 * drawn round a note (one cell) isn't a table.
 */
export function gridsOf(rules: Rule[]): Grid[] {
  const n = rules.length;
  const parent = rules.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i] as number] as number;
    return i;
  };
  const tol = 2;
  for (let i = 0; i < n; i++) {
    const a = rules[i] as Rule;
    if (!a.across) continue;
    for (let j = 0; j < n; j++) {
      const b = rules[j] as Rule;
      if (b.across) continue;
      if (b.at >= a.from - tol && b.at <= a.to + tol && a.at >= b.from - tol && a.at <= b.to + tol)
        parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, Rule[]>();
  rules.forEach((r, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), r]));
  const grids: Grid[] = [];
  for (const g of groups.values()) {
    const xs = cluster(
      g.filter((r) => !r.across).map((r) => r.at),
      1.5,
    );
    const ys = cluster(
      g.filter((r) => r.across).map((r) => r.at),
      1.5,
    );
    if (xs.length < 3 || ys.length < 2) continue;
    const thick = g.map((r) => r.thickness).sort((a, b) => a - b);
    const colors = new Map<string, number>();
    for (const r of g) colors.set(r.color, (colors.get(r.color) ?? 0) + 1);
    grids.push({
      xs,
      ys,
      thickness: thick[Math.floor(thick.length / 2)] ?? 0.5,
      color: [...colors].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "#000000",
    });
  }
  return grids;
}
