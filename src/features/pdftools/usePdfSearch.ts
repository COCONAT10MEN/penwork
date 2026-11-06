import type { EventBus, PDFFindController } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Searching the PDF's text, for the Search tab: every match with the words around it, by page, and
 * a way to go to any of them. pdf.js's own find does the reading and the highlighting on the pages;
 * this reads its matches out for the list and points it at the one picked.
 */

export interface SearchOptions {
  caseSensitive: boolean;
  entireWord: boolean;
}

export interface Hit {
  page: number;
  /** Which match on its page, from 0. */
  index: number;
  before: string;
  match: string;
  after: string;
}

/** The parts of pdf.js's find controller read here; they're public fields, if underscored. */
interface FindInside {
  pageMatches: number[][];
  pageMatchesLength: number[][];
  selected: { pageIdx: number; matchIdx: number };
  _pageContents: string[];
  _offset: { pageIdx: number | null; matchIdx: number | null; wrapped: boolean };
  _selected: { pageIdx: number; matchIdx: number };
  _scrollMatches: boolean;
  _linkService: { page: number; pagesCount: number };
}

/** Shown in the list at most; the count says how many there are in all. */
export const MAX_HITS = 500;
const AROUND_BEFORE = 32;
const AROUND_AFTER = 60;

const tidy = (s: string) => s.replace(/\s+/g, " ");

/** The words around a match, cut at a word so a snippet doesn't start mid-word. */
function around(text: string, at: number, length: number) {
  let from = Math.max(0, at - AROUND_BEFORE);
  if (from > 0) {
    const space = text.indexOf(" ", from);
    if (space !== -1 && space < at) from = space + 1;
  }
  let to = Math.min(text.length, at + length + AROUND_AFTER);
  if (to < text.length) {
    const space = text.lastIndexOf(" ", to);
    if (space > at + length) to = space;
  }
  return {
    before: (from > 0 ? "…" : "") + tidy(text.slice(from, at)),
    match: tidy(text.slice(at, at + length)),
    after: tidy(text.slice(at + length, to)) + (to < text.length ? "…" : ""),
  };
}

/**
 * pdf.js's find made to show one match: its own "next" would only step from the current one. Set
 * as its next step does, so Enter carries on from here.
 */
function pointAt(find: PDFFindController, bus: EventBus, hit: Hit) {
  const inside = find as unknown as FindInside;
  const before = inside._selected.pageIdx;
  inside._selected = { pageIdx: hit.page - 1, matchIdx: hit.index };
  inside._offset = { pageIdx: hit.page - 1, matchIdx: hit.index, wrapped: false };
  inside._scrollMatches = true;
  inside._linkService.page = hit.page;
  if (before >= 0 && before !== hit.page - 1)
    bus.dispatch("updatetextlayermatches", { source: find, pageIndex: before });
  bus.dispatch("updatetextlayermatches", { source: find, pageIndex: hit.page - 1 });
}

export function usePdfSearch(find: PDFFindController | null, bus: EventBus | null) {
  const [query, setQueryState] = useState("");
  const [options, setOptionsState] = useState<SearchOptions>({
    caseSensitive: false,
    entireWord: false,
  });
  const [hits, setHits] = useState<Hit[]>([]);
  const [total, setTotal] = useState(0);
  const [read, setRead] = useState<[number, number]>([0, 0]);
  const [current, setCurrent] = useState<{ page: number; index: number } | null>(null);
  const state = useRef({ query, options });

  const inside = find as unknown as FindInside | null;

  const run = useCallback(
    (type: "" | "again", findPrevious = false) => {
      const { query: q, options: o } = state.current;
      bus?.dispatch("find", {
        source: null,
        type,
        query: q,
        caseSensitive: o.caseSensitive,
        entireWord: o.entireWord,
        highlightAll: true,
        matchDiacritics: false,
        findPrevious,
      });
    },
    [bus],
  );

  // The list is read from pdf.js's matches as pages are searched, a few times a second at most.
  useEffect(() => {
    if (!bus || !inside) return;
    let timer = 0;
    const build = () => {
      timer = 0;
      const out: Hit[] = [];
      let count = 0;
      let done = 0;
      const pages = inside._linkService.pagesCount;
      for (let i = 0; i < pages; i++) {
        const matches = inside.pageMatches[i];
        if (!matches) continue;
        done++;
        count += matches.length;
        const text = inside._pageContents[i] ?? "";
        const lengths = inside.pageMatchesLength[i] ?? [];
        for (let j = 0; j < matches.length && out.length < MAX_HITS; j++)
          out.push({
            page: i + 1,
            index: j,
            ...around(text, matches[j] ?? 0, lengths[j] ?? state.current.query.length),
          });
      }
      setHits(state.current.query ? out : []);
      setTotal(state.current.query ? count : 0);
      setRead([done, pages]);
    };
    const later = () => {
      if (!timer) timer = window.setTimeout(build, 120);
    };
    const onState = () => {
      const s = inside.selected;
      setCurrent(s.pageIdx >= 0 ? { page: s.pageIdx + 1, index: s.matchIdx } : null);
      later();
    };
    bus.on("updatefindmatchescount", later);
    bus.on("updatefindcontrolstate", onState);
    return () => {
      clearTimeout(timer);
      bus.off("updatefindmatchescount", later);
      bus.off("updatefindcontrolstate", onState);
    };
  }, [bus, inside]);

  const clear = useCallback(() => {
    bus?.dispatch("findbarclose", { source: null });
    setHits([]);
    setTotal(0);
    setCurrent(null);
  }, [bus]);

  const setQuery = (q: string) => {
    state.current = { ...state.current, query: q };
    setQueryState(q);
    if (q.trim()) run("");
    else clear();
  };
  const setOptions = (o: SearchOptions) => {
    state.current = { ...state.current, options: o };
    setOptionsState(o);
    if (state.current.query.trim()) run("");
  };

  return {
    query,
    setQuery,
    options,
    setOptions,
    hits,
    total,
    /** Pages searched so far, of all. */
    read,
    current,
    /** The next match (or the one before), from the one shown. */
    step: (back: boolean) => {
      if (state.current.query.trim()) run("again", back);
    },
    /** Goes to one match: the page scrolls to it and it's marked as the current one. */
    go: (hit: Hit) => {
      if (!find || !bus) return;
      pointAt(find, bus, hit);
      setCurrent({ page: hit.page, index: hit.index });
    },
    /** Shows the highlights again after the sheet was closed. */
    resume: () => {
      if (state.current.query.trim()) run("");
    },
    clear,
  };
}

export type PdfSearch = ReturnType<typeof usePdfSearch>;
