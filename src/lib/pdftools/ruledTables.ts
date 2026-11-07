import type { CellAlign, Line, Piece, Ruled, Run, TableBlock } from "./pageLayout";
import type { Fill, Grid } from "./rules";
import { runsOf } from "./runs";

/**
 * Tables drawn with lines, read from their lines: each piece of text goes in the cell it sits in,
 * however tight the columns (a spreadsheet's are), and the table keeps its column widths, row
 * heights, borders, shaded cells and how each cell's words sit. A grid with little text in it is
 * a drawing (graph paper, a diagram), not a table.
 */
export function ruledTables(
  pieces: Piece[],
  grids: Grid[],
  fills: Fill[],
): { tables: TableBlock[]; rest: Piece[] } {
  let rest = pieces;
  const tables: TableBlock[] = [];
  for (const g of grids) {
    const xs = g.xs;
    const ys = g.ys;
    const left = xs[0] as number;
    const right = xs[xs.length - 1] as number;
    const top = ys[0] as number;
    const bottom = ys[ys.length - 1] as number;
    const cols = xs.length - 1;
    const rows = ys.length - 1;
    // Where a piece is: its middle across, and the middle of its letters down.
    const cellOf = (p: Piece) => {
      const cx = p.x + p.width / 2;
      const cy = p.y - p.size * 0.35;
      if (cx < left || cx > right || cy < top || cy > bottom) return null;
      let c = 0;
      while (c < cols - 1 && cx > (xs[c + 1] as number)) c++;
      let r = 0;
      while (r < rows - 1 && cy > (ys[r + 1] as number)) r++;
      return { r, c };
    };
    const cells: Piece[][][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => []),
    );
    const inside: Piece[] = [];
    for (const p of rest) {
      if (!p.text.trim()) continue;
      const at = cellOf(p);
      if (!at) continue;
      cells[at.r]?.[at.c]?.push(p);
      inside.push(p);
    }
    const filled = cells.flat().filter((c) => c.length).length;
    const rowsWithText = cells.filter((row) => row.some((c) => c.length)).length;
    if (filled < 2 || filled < rows * cols * 0.4 || rowsWithText < rows * 0.6) continue;
    const taken = new Set(inside);
    // The spaces between cells that read as text go with it.
    rest = rest.filter((p) => !taken.has(p) && !(cellOf(p) && !p.text.trim()));

    const lines: Line[][][] = cells.map((row) => row.map(linesOf));
    const align: CellAlign[][] = [];
    const valign: Ruled["valign"] = [];
    const shade: Ruled["shade"] = [];
    const gaps: number[] = [];
    for (let r = 0; r < rows; r++) {
      align.push([]);
      valign.push([]);
      shade.push([]);
      for (let c = 0; c < cols; c++) {
        const x0 = xs[c] as number;
        const x1 = xs[c + 1] as number;
        const y0 = ys[r] as number;
        const y1 = ys[r + 1] as number;
        const ls = lines[r]?.[c] ?? [];
        const fill = [...fills]
          .reverse()
          .find(
            (f) =>
              Math.max(0, Math.min(f.x1, x1) - Math.max(f.x0, x0)) *
                Math.max(0, Math.min(f.y1, y1) - Math.max(f.y0, y0)) >
              0.8 * (x1 - x0) * (y1 - y0),
          );
        shade[r]?.push(fill && fill.color !== "#ffffff" ? fill.color : null);
        if (!ls.length) {
          align[r]?.push("left");
          valign[r]?.push("top");
          continue;
        }
        const tx0 = Math.min(...ls.map((l) => l.x0));
        const tx1 = Math.max(...ls.map((l) => l.x1));
        const lg = tx0 - x0;
        const rg = x1 - tx1;
        const a: CellAlign =
          Math.abs(lg - rg) <= 3 && lg > 6 ? "center" : lg <= rg ? "left" : "right";
        align[r]?.push(a);
        gaps.push(a === "right" ? rg : lg);
        const size = Math.max(...ls.flatMap((l) => l.runs.map((x) => x.size)));
        const tg = (ls[0] as Line).baseline - size * 0.8 - y0;
        const bg = y1 - ((ls[ls.length - 1] as Line).baseline + size * 0.22);
        valign[r]?.push(Math.abs(tg - bg) <= 2 ? "center" : bg < tg ? "bottom" : "top");
      }
    }
    const sorted = gaps.filter((x) => x >= 0).sort((a, b) => a - b);
    const ruled: Ruled = {
      lines,
      align,
      valign,
      shade,
      padding: Math.max(0.5, Math.min(6, sorted[0] ?? 3)),
      thickness: g.thickness,
      color: g.color,
    };
    tables.push({
      kind: "table",
      top,
      bottom,
      left,
      right,
      spaceBefore: 0,
      columns: xs.slice(0, -1),
      rows: lines.map((row) => row.map(joined)),
      rowTops: ys.slice(0, -1),
      rowBottoms: ys.slice(1),
      ruled,
    });
  }
  return { tables, rest };
}

/** A cell's pieces as lines of text, top to bottom. */
function linesOf(pieces: Piece[]): Line[] {
  const sorted = [...pieces].sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: Piece[][] = [];
  for (const p of sorted) {
    const g = groups[groups.length - 1];
    const first = g?.[0];
    if (g && first && Math.abs(first.y - p.y) < Math.max(first.size, p.size) * 0.5) g.push(p);
    else groups.push([p]);
  }
  return groups.map((g) => {
    const line = [...g].sort((a, b) => a.x - b.x);
    return {
      runs: runsOf(line),
      baseline: (line[0] as Piece).y,
      x0: Math.min(...line.map((p) => p.x)),
      x1: Math.max(...line.map((p) => p.x + p.width)),
    };
  });
}

/** A cell's lines as one run of text, a space where a line ended. */
function joined(lines: Line[]): Run[] {
  return lines.flatMap((l, i) =>
    l.runs.map((r, j) =>
      i > 0 && j === 0 ? { ...r, text: ` ${r.text.trimStart()}`, parts: undefined } : r,
    ),
  );
}
