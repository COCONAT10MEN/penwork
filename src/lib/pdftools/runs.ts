import type { Part, Piece, Run } from "./pageLayout";

/** A segment's words as runs: pieces of one style join, and gaps the PDF left become spaces. */
export function runsOf(pieces: Piece[]): Run[] {
  const runs: Run[] = [];
  const startOf = new Map<Run, number>();
  let end = -Infinity;
  for (const p of pieces) {
    const gap = p.x - end > p.size * 0.18;
    const last = runs[runs.length - 1];
    let text = p.text;
    const spaced = last && gap && !last.text.endsWith(" ") && !text.startsWith(" ");
    if (spaced) text = ` ${text}`;
    const parts: Part[] = (p.parts ?? [{ text: p.text, x: p.x, width: p.width }]).map((q, i) =>
      i === 0 && spaced ? { ...q, text: ` ${q.text}` } : q,
    );
    if (
      last &&
      last.font === p.font &&
      Math.abs(last.size - p.size) < 0.25 &&
      last.bold === p.bold &&
      last.italic === p.italic &&
      last.color === p.color &&
      last.rise === (p.rise ?? 0)
    ) {
      last.text += text;
      last.width = p.x + p.width - (startOf.get(last) ?? p.x);
      last.parts = [...(last.parts ?? []), ...parts];
    } else
      runs.push({
        text,
        font: p.font,
        size: p.size,
        bold: p.bold,
        italic: p.italic,
        color: p.color,
        rise: p.rise ?? 0,
        width: p.width,
        x: p.x,
        parts,
      });
    if (runs[runs.length - 1] !== last) startOf.set(runs[runs.length - 1] as Run, p.x);
    end = p.x + p.width;
  }
  return runs;
}
