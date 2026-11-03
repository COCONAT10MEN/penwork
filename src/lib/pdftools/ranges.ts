/**
 * Page lists as people type them: "1-3, 5, 8-", counted from 1. Out-of-range numbers are dropped
 * rather than refused, so "1-100" on a 12-page file means all twelve.
 */
export function parseRanges(text: string, count: number): number[] | null {
  const pages: number[] = [];
  const parts = text
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  for (const part of parts) {
    const match = /^(\d*)\s*[-–]\s*(\d*)$/.exec(part);
    if (match) {
      const from = match[1] ? Number(match[1]) : 1;
      const to = match[2] ? Number(match[2]) : count;
      if (!from && !to) return null;
      const step = from <= to ? 1 : -1;
      for (let n = from; n !== to + step; n += step) if (n >= 1 && n <= count) pages.push(n);
    } else if (/^\d+$/.test(part)) {
      const n = Number(part);
      if (n >= 1 && n <= count) pages.push(n);
    } else {
      return null;
    }
  }
  return pages;
}

/** The same pages without repeats, in order: for tools where a page is either in or out. */
export function pageSet(text: string, count: number): number[] | null {
  const pages = parseRanges(text, count);
  return pages && [...new Set(pages)].sort((a, b) => a - b);
}

/** Groups of pages for splitting: every n pages, or the typed ranges, one file each. */
export function splitGroups(
  how: { every: number } | { ranges: string },
  count: number,
): number[][] | null {
  if ("every" in how) {
    const n = Math.max(1, Math.floor(how.every));
    const groups: number[][] = [];
    for (let start = 1; start <= count; start += n)
      groups.push(Array.from({ length: Math.min(n, count - start + 1) }, (_, i) => start + i));
    return groups;
  }
  const groups = how.ranges
    .split(/[,;]+/)
    .map((part) => parseRanges(part, count))
    .filter((g): g is number[] => g !== null && g.length > 0);
  return groups.length ? groups : null;
}

/** "1-3, 5" for a file name or a message. */
export function describePages(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === (sorted[j] ?? 0) + 1) j++;
    out.push(j > i ? `${sorted[i]}-${sorted[j]}` : String(sorted[i]));
    i = j;
  }
  return out.join(", ");
}
