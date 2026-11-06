import type { Picked } from "./files";

/** The values the Split and Merge fields hold (PageToolFields.tsx), and what Split makes of them. */

export interface SplitValue {
  how: "every" | "n" | "ranges";
  n: number;
  /** From and to, both counted from 1 and included. */
  ranges: [number, number][];
}

/** The files a split makes, as lists of pages. */
export function splitParts(v: SplitValue, count: number): number[][] {
  if (v.how === "ranges")
    return v.ranges
      .map(([a, b]) => [Math.max(1, Math.min(a, b)), Math.min(count, Math.max(a, b))] as const)
      .filter(([a, b]) => a <= b)
      .map(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i));
  const n = v.how === "every" ? 1 : Math.max(1, v.n);
  const out: number[][] = [];
  for (let start = 1; start <= count; start += n)
    out.push(Array.from({ length: Math.min(n, count - start + 1) }, (_, i) => start + i));
  return out;
}

/** One PDF in the merge: this one, or a file added. */
export type MergeItem = { id: string; file: Picked | null };

export const THIS_PDF: MergeItem = { id: "this", file: null };
