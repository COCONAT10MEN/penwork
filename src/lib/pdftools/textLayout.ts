/**
 * A PDF holds words at positions, not paragraphs. This puts them back into lines, paragraphs,
 * headings and table columns, for Word, Excel, Markdown and Compare.
 */

export interface Word {
  text: string;
  /** Left edge and baseline, from the page's top-left, in points. */
  x: number;
  y: number;
  width: number;
  /** Font size. */
  size: number;
  bold: boolean;
}

export interface Line {
  words: Word[];
  text: string;
  x: number;
  y: number;
  size: number;
  bold: boolean;
}

export interface Paragraph {
  text: string;
  size: number;
  bold: boolean;
  heading: 0 | 1 | 2 | 3;
  /** Starts with a bullet or a number. */
  list: "bullet" | "number" | null;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

/** Words on the same baseline (within a third of their size) make a line, read left to right. */
export function toLines(words: Word[]): Line[] {
  const sorted = words.filter((w) => w.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Word[][] = [];
  for (const w of sorted) {
    const last = lines[lines.length - 1];
    const head = last?.[0];
    if (last && head && Math.abs(head.y - w.y) <= Math.max(2, Math.min(head.size, w.size) * 0.35))
      last.push(w);
    else lines.push([w]);
  }
  return lines.map((ws): Line => {
    const first = ws[0] as Word;
    ws.sort((a, b) => a.x - b.x);
    let text = "";
    let end = -Infinity;
    for (const w of ws) {
      // A gap wider than a fifth of the size is a space the PDF didn't write as one.
      if (text && w.x - end > w.size * 0.2 && !text.endsWith(" ") && !w.text.startsWith(" "))
        text += " ";
      text += w.text;
      end = w.x + w.width;
    }
    const size = median(ws.map((w) => w.size)) ?? first.size;
    return {
      words: ws,
      text: text.replace(/\s+/g, " ").trim(),
      x: first.x,
      y: first.y,
      size,
      bold: ws.filter((w) => w.bold).length > ws.length / 2,
    };
  });
}

const BULLET = /^([•·▪◦‣\-–*])\s+/;
const NUMBERED = /^(\(?\d{1,3}[.)]|[a-z][.)])\s+/i;

/** Lines close together with the same look join into a paragraph; bigger text is a heading. */
export function toParagraphs(lines: Line[]): Paragraph[] {
  const body = median(lines.map((l) => l.size)) || 11;
  const out: Paragraph[] = [];
  let prev: Line | null = null;
  for (const line of lines) {
    const ratio = line.size / body;
    const heading: Paragraph["heading"] =
      ratio >= 1.6 ? 1 : ratio >= 1.3 ? 2 : ratio >= 1.12 && line.bold ? 3 : 0;
    const list = BULLET.test(line.text) ? "bullet" : NUMBERED.test(line.text) ? "number" : null;
    const last = out[out.length - 1];
    const gap = prev ? line.y - prev.y : Infinity;
    const joins =
      last &&
      prev &&
      !heading &&
      !last.heading &&
      !list &&
      Math.abs(line.size - prev.size) < 0.6 &&
      gap > 0 &&
      gap < prev.size * 1.75;
    if (joins) {
      last.text = last.text.endsWith("-")
        ? last.text.slice(0, -1) + line.text
        : `${last.text} ${line.text}`;
    } else {
      out.push({
        text: list ? line.text.replace(list === "bullet" ? BULLET : NUMBERED, "") : line.text,
        size: line.size,
        bold: line.bold,
        heading,
        list,
      });
    }
    prev = line;
  }
  return out;
}

/**
 * Rows and columns for a spreadsheet: each line is a row, and words go into columns where many
 * lines start text at the same place.
 */
export function toTable(lines: Line[]): string[][] {
  const starts: number[] = [];
  for (const line of lines) {
    let end = -Infinity;
    for (const w of line.words) {
      if (w.x - end > w.size * 0.9) starts.push(w.x);
      end = w.x + w.width;
    }
  }
  starts.sort((a, b) => a - b);
  const columns: number[] = [];
  for (const x of starts) {
    if (!columns.length || x - (columns[columns.length - 1] ?? -Infinity) > 8) columns.push(x);
  }
  const columnOf = (x: number) => {
    let best = 0;
    for (let i = 0; i < columns.length; i++) if ((columns[i] ?? Infinity) <= x + 4) best = i;
    return best;
  };
  return lines.map((line) => {
    const row: string[] = new Array(columns.length).fill("");
    let end = -Infinity;
    let col = -1;
    for (const w of line.words) {
      if (col < 0 || w.x - end > w.size * 0.9) col = columnOf(w.x);
      else if (row[col] && !row[col]?.endsWith(" ")) row[col] += " ";
      row[col] = (row[col] + w.text).replace(/\s+/g, " ");
      end = w.x + w.width;
    }
    return row.map((c) => c.trim());
  });
}

/** Text as a spreadsheet cell: numbers as numbers, so they can be added up. */
export function cellValue(text: string): string | number {
  const t = text.replace(/[\s,]/g, "");
  if (/^[-+]?\d+(\.\d+)?$/.test(t) && t.length < 16) return Number(t);
  return text;
}

/**
 * Text as a spreadsheet cell that keeps its look: "14%" is 0.14 shown as a percentage, "1,250,000"
 * a number shown with separators, "$1,200.50" a number shown as money. Anything else stays text.
 */
export function cellOf(text: string): { value: string | number; format?: string } {
  const t = text.trim().replace(/\s/g, "");
  const pct = /^([-+]?\d+(?:\.(\d+))?)%$/.exec(t);
  if (pct)
    return {
      value: Number(pct[1]) / 100,
      format: pct[2] ? `0.${"0".repeat(pct[2].length)}%` : "0%",
    };
  const money = /^([-+]?)([$€£¥])([\d,]+(?:\.(\d+))?)$/.exec(t);
  if (money && /^\d{1,3}(,\d{3})*(\.\d+)?$|^\d+(\.\d+)?$/.test(money[3] ?? "")) {
    const n = Number((money[3] ?? "").replace(/,/g, "")) * (money[1] === "-" ? -1 : 1);
    const decimals = money[4]?.length ?? 0;
    return { value: n, format: `"${money[2]}"#,##0${decimals ? `.${"0".repeat(decimals)}` : ""}` };
  }
  const grouped = /^[-+]?\d{1,3}(,\d{3})+(\.(\d+))?$/.exec(t);
  if (grouped) {
    const decimals = grouped[3]?.length ?? 0;
    return {
      value: Number(t.replace(/,/g, "")),
      format: `#,##0${decimals ? `.${"0".repeat(decimals)}` : ""}`,
    };
  }
  const value = cellValue(text);
  return { value };
}

export function toMarkdown(paragraphs: Paragraph[]): string {
  let n = 0;
  return paragraphs
    .map((p) => {
      if (p.list !== "number") n = 0;
      if (p.heading) return `${"#".repeat(p.heading)} ${p.text}`;
      if (p.list === "bullet") return `- ${p.text}`;
      if (p.list === "number") return `${++n}. ${p.text}`;
      return p.bold ? `**${p.text}**` : p.text;
    })
    .join("\n\n");
}
