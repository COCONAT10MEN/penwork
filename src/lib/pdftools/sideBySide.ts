import type { Block, ParagraphBlock } from "./pageLayout";

/**
 * Short lines set side by side: a letterhead with the address on the left and the date on the
 * right, a CV's name beside its contact lines, an invoice's sender beside its number. Read top to
 * bottom they take turns, left and right; Word can't set two paragraphs beside each other, so in
 * a document they're two cells of a table without lines.
 */
export interface SideBySide {
  kind: "sideBySide";
  left: ParagraphBlock[];
  right: ParagraphBlock[];
  top: number;
  bottom: number;
  /** Where the left side starts, where the two meet, and where the right side ends. */
  x0: number;
  gutter: number;
  x1: number;
}

const para = (b: Block | undefined): b is ParagraphBlock =>
  !!b && b.kind === "paragraph" && !b.column;

export function sideBySide(blocks: Block[]): (Block | SideBySide)[] {
  const out: (Block | SideBySide)[] = [];
  let i = 0;
  while (i < blocks.length) {
    const a = blocks[i] as Block;
    const b = blocks[i + 1];
    if (para(a) && para(b) && (a.right < b.left || b.right < a.left)) {
      const first = a.right < b.left ? a : b;
      const second = first === a ? b : a;
      const gutter = (first.right + second.left) / 2;
      const left: ParagraphBlock[] = [];
      const right: ParagraphBlock[] = [];
      let bottom = -Infinity;
      let j = i;
      while (j < blocks.length) {
        const c = blocks[j];
        if (!para(c)) break;
        const side = c.right < gutter ? left : c.left > gutter ? right : null;
        // It belongs while it's on one side, and close below what's there.
        if (!side || (j > i + 1 && c.top > bottom + c.size * 1.5)) break;
        side.push(c);
        bottom = Math.max(bottom, c.bottom);
        j++;
      }
      const span = (list: ParagraphBlock[]) => [
        Math.min(...list.map((x) => x.top)),
        Math.max(...list.map((x) => x.bottom)),
      ];
      if (left.length && right.length) {
        const [lt = 0, lb = 0] = span(left);
        const [rt = 0, rb = 0] = span(right);
        // Beside each other means level with each other for a while.
        if (Math.min(lb, rb) - Math.max(lt, rt) > 0) {
          out.push({
            kind: "sideBySide",
            left,
            right,
            top: Math.min(lt, rt),
            bottom: Math.max(lb, rb),
            x0: Math.min(...left.map((x) => x.left)),
            gutter,
            x1: Math.max(...right.map((x) => x.right)),
          });
          i = j;
          continue;
        }
      }
    }
    out.push(a);
    i++;
  }
  return out;
}
