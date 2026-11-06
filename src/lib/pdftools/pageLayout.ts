/**
 * A page's layout read back from where its words and pictures are: paragraphs with their own fonts,
 * sizes, colours, alignment, indents and spacing; tables where words line up in columns row after
 * row; text in columns read column by column; pictures where they sit. Word, PowerPoint, Excel and
 * Markdown are written from this. Everything is in points from the page's top-left.
 */

/** A piece of text the PDF draws in one go, in one style. */
export interface Piece {
  text: string;
  /** Left edge and baseline. */
  x: number;
  y: number;
  width: number;
  size: number;
  font: string;
  bold: boolean;
  italic: boolean;
  /** "#rrggbb". */
  color: string;
}

export interface Picture {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Run {
  text: string;
  font: string;
  size: number;
  bold: boolean;
  italic: boolean;
  color: string;
}

/** Where a block sits when the text runs in two columns: which run of columns, which side. */
export interface Column {
  region: number;
  index: 0 | 1;
  left: number;
  right: number;
}

export interface ParagraphBlock {
  kind: "paragraph";
  column?: Column;
  /** Top of the first line's letters, left and right of the text. */
  top: number;
  bottom: number;
  left: number;
  right: number;
  align: "left" | "center" | "right" | "justify";
  /** How far the first line starts from the others (negative hangs out). */
  firstLine: number;
  /** Space above, from the block before it (or the top of the text area). */
  spaceBefore: number;
  /** Baseline to baseline, for paragraphs of more than one line. */
  lineHeight: number | null;
  /** 1 to 3 for headings, by size; 0 for body text. */
  heading: 0 | 1 | 2 | 3;
  list: "bullet" | "number" | null;
  size: number;
  runs: Run[];
}

export interface TableBlock {
  kind: "table";
  top: number;
  bottom: number;
  left: number;
  right: number;
  spaceBefore: number;
  /** Where each column starts. */
  columns: number[];
  rows: Run[][][];
  /** Each row's top and bottom. */
  rowTops: number[];
  rowBottoms: number[];
}

export interface PictureBlock {
  kind: "picture";
  top: number;
  bottom: number;
  left: number;
  right: number;
  spaceBefore: number;
  id: number;
}

export type Block = ParagraphBlock | TableBlock | PictureBlock;

export interface PageLayout {
  width: number;
  height: number;
  /** The text area: where the text starts and ends across the page, and its top and bottom. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  blocks: Block[];
  /** The usual body text size, for telling headings from text. */
  body: number;
}

/** Part of a line: words close together. A wide gap starts another (a column, a cell). */
interface Segment {
  pieces: Piece[];
  x0: number;
  x1: number;
  y: number;
  size: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[Math.floor(s.length / 2)] as number) : 0;
};

const ascent = (s: Segment) => s.y - s.size * 0.8;
const descent = (s: Segment) => s.y + s.size * 0.22;

/** Lines by baseline, each split into segments where the gap is wider than a column gutter. */
function toLines(pieces: Piece[]): Segment[][] {
  const sorted = pieces.filter((p) => p.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Piece[][] = [];
  for (const p of sorted) {
    const last = lines[lines.length - 1];
    const head = last?.[0];
    if (last && head && Math.abs(head.y - p.y) <= Math.max(1.5, Math.min(head.size, p.size) * 0.35))
      last.push(p);
    else lines.push([p]);
  }
  return lines.map((line) => {
    line.sort((a, b) => a.x - b.x);
    const segments: Segment[] = [];
    for (const p of line) {
      const s = segments[segments.length - 1];
      if (s && p.x - s.x1 < Math.max(p.size, s.size) * 1.6) {
        s.pieces.push(p);
        s.x1 = Math.max(s.x1, p.x + p.width);
        s.size = Math.max(s.size, p.size);
      } else segments.push({ pieces: [p], x0: p.x, x1: p.x + p.width, y: p.y, size: p.size });
    }
    return segments;
  });
}

/** A segment's words as runs: pieces of one style join, and gaps the PDF left become spaces. */
function runsOf(pieces: Piece[]): Run[] {
  const runs: Run[] = [];
  let end = -Infinity;
  for (const p of pieces) {
    const gap = p.x - end > p.size * 0.18;
    const last = runs[runs.length - 1];
    let text = p.text;
    if (last && gap && !last.text.endsWith(" ") && !text.startsWith(" ")) text = ` ${text}`;
    if (
      last &&
      last.font === p.font &&
      Math.abs(last.size - p.size) < 0.25 &&
      last.bold === p.bold &&
      last.italic === p.italic &&
      last.color === p.color
    )
      last.text += text;
    else
      runs.push({
        text,
        font: p.font,
        size: p.size,
        bold: p.bold,
        italic: p.italic,
        color: p.color,
      });
    end = p.x + p.width;
  }
  return runs;
}

const textOf = (runs: Run[]) => runs.map((r) => r.text).join("");
const BULLET = /^\s*([•·▪◦‣●○■□\-–*])\s+/;
const NUMBERED = /^\s*(\(?\d{1,3}[.)]|[a-z][.)])\s+/i;

/** Rows of segments that line up in the same columns, three rows or more (or two with a rule). */
function findTables(lines: Segment[][], pageWidth: number) {
  const tables: { from: number; to: number; columns: number[] }[] = [];
  const fits = (columns: number[], line: Segment[]) =>
    line.length >= 2 &&
    line.every((s) => columns.some((c) => Math.abs(c - s.x0) <= 8)) &&
    // A line of prose split by one wide gap is a column layout, not a table row.
    line.every((s) => s.x1 - s.x0 < pageWidth * 0.36);
  let i = 0;
  while (i < lines.length) {
    const first = lines[i] as Segment[];
    if (
      first.length < 2 ||
      !fits(
        first.map((s) => s.x0),
        first,
      )
    ) {
      i++;
      continue;
    }
    const columns = first.map((s) => s.x0);
    let j = i + 1;
    while (j < lines.length) {
      const line = lines[j] as Segment[];
      const prev = lines[j - 1] as Segment[];
      const gap = (line[0]?.y ?? 0) - (prev[0]?.y ?? 0);
      if (gap > (prev[0]?.size ?? 10) * 3) break;
      // New columns may appear in later rows (an empty first cell).
      if (line.length >= 2 && line.every((s) => s.x1 - s.x0 < pageWidth * 0.36)) {
        for (const s of line) if (!columns.some((c) => Math.abs(c - s.x0) <= 8)) columns.push(s.x0);
        j++;
      } else break;
    }
    if (j - i >= 2 && columns.length >= 2) {
      tables.push({ from: i, to: j, columns: columns.sort((a, b) => a - b) });
      i = j;
    } else i++;
  }
  return tables;
}

/**
 * Runs of lines where the text is in two columns: lines split at the same gutter, with at least one
 * column line of real prose width. The short last lines of a column belong to the run too.
 */
function findColumns(lines: Segment[][], left: number, right: number) {
  const width = right - left;
  const runs: { from: number; to: number; gutter: number }[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as Segment[];
    if (line.length !== 2) {
      i++;
      continue;
    }
    const [a, b] = line as [Segment, Segment];
    const gutter = (a.x1 + b.x0) / 2;
    let j = i;
    let wide = false;
    while (j < lines.length) {
      const l = lines[j] as Segment[];
      const ok =
        (l.length === 2 && (l[0] as Segment).x1 < gutter && (l[1] as Segment).x0 > gutter) ||
        (l.length === 1 && ((l[0] as Segment).x1 < gutter || (l[0] as Segment).x0 > gutter));
      if (!ok) break;
      if (l.some((x) => x.x1 - x.x0 > width * 0.3)) wide = true;
      j++;
    }
    if (wide && j - i >= 2) {
      runs.push({ from: i, to: j, gutter });
      i = j;
    } else i++;
  }
  return runs;
}

/** Lines in reading order: in a run of two columns, the left column first, then the right. */
function readingOrder(
  lines: Segment[][],
  columns: { from: number; to: number; gutter: number }[],
  skip: Set<number>,
  where: Map<Segment, Column>,
): Segment[][] {
  const out: Segment[][] = [];
  let i = 0;
  while (i < lines.length) {
    const run = columns.find((c) => c.from === i);
    if (!run) {
      if (!skip.has(i)) out.push(lines[i] as Segment[]);
      i++;
      continue;
    }
    const leftCol: Segment[][] = [];
    const rightCol: Segment[][] = [];
    for (let k = run.from; k < run.to; k++)
      for (const seg of lines[k] as Segment[])
        (seg.x1 < run.gutter ? leftCol : rightCol).push([seg]);
    const region = columns.indexOf(run);
    const l = leftCol.flat();
    const r = rightCol.flat();
    const leftSide: Column = {
      region,
      index: 0,
      left: Math.min(...l.map((x) => x.x0)),
      right: Math.max(...l.map((x) => x.x1)),
    };
    const rightSide: Column = {
      region,
      index: 1,
      left: Math.min(...r.map((x) => x.x0)),
      right: Math.max(...r.map((x) => x.x1)),
    };
    for (const x of l) where.set(x, leftSide);
    for (const x of r) where.set(x, rightSide);
    out.push(...leftCol, ...rightCol);
    i = run.to;
  }
  return out;
}

/** The page's layout, from its text pieces and pictures. */
export function layoutPage(
  pieces: Piece[],
  pictures: Picture[],
  page: { width: number; height: number },
): PageLayout {
  const all = toLines(pieces);
  const segs = all.flat();
  const left = segs.length ? Math.min(...segs.map((s) => s.x0)) : 72;
  const right = segs.length ? Math.max(...segs.map((s) => s.x1)) : page.width - 72;
  const body = median(segs.flatMap((s) => s.pieces.map((p) => p.size))) || 11;
  const columnRuns = findColumns(all, left, right);
  const inColumns = new Set<number>();
  for (const c of columnRuns) for (let i = c.from; i < c.to; i++) inColumns.add(i);
  // Tables only where the text isn't in columns; their lines are taken out of the text.
  const tables = findTables(
    all.map((line, i) => (inColumns.has(i) ? [] : line)),
    page.width,
  );
  const inTable = new Set<number>();
  for (const t of tables) for (let i = t.from; i < t.to; i++) inTable.add(i);

  const items: { top: number; block: Block | Segment[] }[] = [];
  for (const t of tables) {
    const rows = all.slice(t.from, t.to);
    const columns = t.columns;
    const cellOf = (x: number) => {
      let best = 0;
      for (let k = 0; k < columns.length; k++) if ((columns[k] as number) <= x + 8) best = k;
      return best;
    };
    const runs = rows.map((line) => {
      const cells: Run[][] = columns.map(() => []);
      for (const s of line) cells[cellOf(s.x0)]?.push(...runsOf(s.pieces));
      return cells;
    });
    const firstRow = rows[0] as Segment[];
    const lastRow = rows[rows.length - 1] as Segment[];
    items.push({
      top: Math.min(...firstRow.map(ascent)),
      block: {
        kind: "table",
        top: Math.min(...firstRow.map(ascent)),
        bottom: Math.max(...lastRow.map(descent)),
        left: Math.min(...rows.flat().map((s) => s.x0)),
        right: Math.max(...rows.flat().map((s) => s.x1)),
        spaceBefore: 0,
        columns,
        rows: runs,
        rowTops: rows.map((line) => Math.min(...line.map(ascent))),
        rowBottoms: rows.map((line) => Math.max(...line.map(descent))),
      },
    });
  }
  const where = new Map<Segment, Column>();
  const free = readingOrder(all, columnRuns, inTable, where);
  for (const line of free) for (const s of line) items.push({ top: ascent(s), block: [s] });
  for (const p of pictures)
    items.push({
      top: p.y,
      block: {
        kind: "picture",
        top: p.y,
        bottom: p.y + p.height,
        left: p.x,
        right: p.x + p.width,
        spaceBefore: 0,
        id: p.id,
      },
    });

  // Text in reading order stays in that order; tables and pictures go in where they sit.
  const textOrder = new Map<Segment, number>();
  free.flat().forEach((s, i) => textOrder.set(s, i));
  const placed: (Block | Segment)[] = [];
  const others = items
    .filter((it) => !Array.isArray(it.block))
    .sort((a, b) => a.top - b.top)
    .map((it) => it.block as Block);
  const segmentsInOrder = free.flat();
  let k = 0;
  for (const s of segmentsInOrder) {
    while (k < others.length && (others[k] as Block).top < ascent(s) - 2)
      placed.push(others[k++] as Block);
    placed.push(s);
  }
  while (k < others.length) placed.push(others[k++] as Block);

  // Segments into paragraphs.
  const blocks: Block[] = [];
  let open: { segs: Segment[] } | null = null;
  const segsOf = new Map<Block, Segment>();
  const close = () => {
    if (!open) return;
    const p = paragraphOf(open.segs, left, right, body);
    segsOf.set(p, open.segs[0] as Segment);
    blocks.push(p);
    open = null;
  };
  for (const item of placed) {
    if (!("pieces" in item)) {
      close();
      blocks.push(item);
      continue;
    }
    const s = item;
    const startsList =
      BULLET.test(textOf(runsOf(s.pieces))) || NUMBERED.test(textOf(runsOf(s.pieces)));
    const current = open as { segs: Segment[] } | null;
    if (current) {
      const prev = current.segs[current.segs.length - 1] as Segment;
      const first = current.segs[0] as Segment;
      const gap = s.y - prev.y;
      // Within about a tenth: OCR'd text and some PDFs vary a little line to line.
      const sameSize = Math.abs(s.size - prev.size) < Math.max(0.6, prev.size * 0.12);
      const sameLeft =
        Math.abs(s.x0 - (current.segs.length > 1 ? prev.x0 : first.x0)) <= 3 ||
        (current.segs.length === 1 && s.x0 < first.x0 && first.x0 - s.x0 < 40);
      // A line well short of the right edge ends its paragraph, unless the text is centred.
      const prevFull =
        prev.x1 >
          (current.segs.length ? Math.max(...current.segs.map((x) => x.x1)) : right) - s.size * 4 ||
        prev.x1 > right - s.size * 6;
      const joins =
        sameSize &&
        gap > s.size * 0.6 &&
        gap < s.size * 1.7 &&
        sameLeft &&
        prevFull &&
        !startsList &&
        headingOf(s.size, body) === 0;
      if (joins) {
        current.segs.push(s);
        continue;
      }
    }
    close();
    open = { segs: [s] };
  }
  close();
  for (const b of blocks) {
    if (b.kind !== "paragraph") continue;
    const seg = segsOf.get(b);
    const column = seg ? where.get(seg) : undefined;
    if (column) b.column = column;
  }

  // Space above each block, from the one before it.
  let prevBottom: number | null = null;
  let beforeColumns: number | null = null;
  let lastColumn: Column | undefined;
  for (const b of blocks) {
    const column = b.kind === "paragraph" ? b.column : undefined;
    if (column && !lastColumn) beforeColumns = prevBottom;
    if (column && lastColumn && column.index !== lastColumn.index) prevBottom = beforeColumns;
    b.spaceBefore = prevBottom === null ? 0 : Math.max(0, b.top - prevBottom);
    prevBottom = b.bottom;
    lastColumn = column;
  }
  return {
    width: page.width,
    height: page.height,
    left,
    right,
    top: blocks.length ? Math.min(...blocks.map((b) => b.top)) : 72,
    bottom: blocks.length ? Math.max(...blocks.map((b) => b.bottom)) : page.height - 72,
    blocks,
    body,
  };
}

function headingOf(size: number, body: number): 0 | 1 | 2 | 3 {
  const r = size / body;
  return r >= 1.75 ? 1 : r >= 1.35 ? 2 : r >= 1.15 ? 3 : 0;
}

function paragraphOf(segs: Segment[], left: number, right: number, body: number): ParagraphBlock {
  const first = segs[0] as Segment;
  const rest = segs.slice(1);
  const x0 = rest.length ? Math.min(...rest.map((s) => s.x0)) : first.x0;
  const x1 = Math.max(...segs.map((s) => s.x1));
  const center = (first.x0 + first.x1) / 2;
  const width = right - left;
  let align: ParagraphBlock["align"] = "left";
  // Justified text ends every line but the last exactly at the edge; ragged text doesn't.
  const edge = Math.max(...segs.map((s) => s.x1));
  const flush = segs.slice(0, -1).every((s) => Math.abs(s.x1 - edge) < 1);
  if (segs.length > 2 && flush) align = "justify";
  else if (
    Math.abs(center - (left + right) / 2) < 6 &&
    first.x1 - first.x0 < width * 0.9 &&
    first.x0 > left + 12
  )
    align = "center";
  else if (Math.abs(first.x1 - right) < 4 && first.x0 > left + width * 0.3) align = "right";
  // Runs line by line, joined with a space, or straight on after a hyphen.
  const runs: Run[] = [];
  for (const [i, s] of segs.entries()) {
    const own = runsOf(s.pieces);
    if (i > 0 && own[0]) {
      const last = runs[runs.length - 1];
      if (last && last.text.endsWith("-") && /^[a-z]/.test(own[0].text))
        last.text = last.text.slice(0, -1);
      else own[0].text = ` ${own[0].text.trimStart()}`;
    }
    for (const r of own) {
      const last = runs[runs.length - 1];
      if (
        last &&
        last.font === r.font &&
        last.size === r.size &&
        last.bold === r.bold &&
        last.italic === r.italic &&
        last.color === r.color
      )
        last.text += r.text;
      else runs.push({ ...r });
    }
  }
  const text = textOf(runs);
  const list = BULLET.test(text) ? "bullet" : NUMBERED.test(text) ? "number" : null;
  const size = median(segs.flatMap((s) => s.pieces.map((p) => p.size)));
  const gaps = segs.slice(1).map((s, i) => s.y - (segs[i] as Segment).y);
  return {
    kind: "paragraph",
    top: ascent(first),
    bottom: descent(segs[segs.length - 1] as Segment),
    left: align === "center" || align === "right" ? first.x0 : x0,
    right: x1,
    align,
    firstLine: align === "left" || align === "justify" ? first.x0 - x0 : 0,
    spaceBefore: 0,
    lineHeight: gaps.length ? median(gaps) : null,
    heading: headingOf(size, body),
    list,
    size,
    runs,
  };
}
