import { useCallback, useEffect, useRef } from "react";
import { useApp } from "../../appStore";
import type { OfficeKind } from "../../lib/office";
import { captureThumb } from "../deck/thumbnail";

// The page has to be drawn and its rise finished, or the picture catches it part-way.
const SETTLED_MS = 2400;

const PAGE: Record<OfficeKind, string> = {
  word: ".docx-pages > *",
  sheet: ".fortune-sheet-container",
  pdf: ".pdfViewer .page",
};

/** The top of the first page: what Home and Files show for this file. */
function pageTop(kind: OfficeKind): DOMRect | null {
  const page = document.querySelector(PAGE[kind])?.getBoundingClientRect();
  if (!page || page.width === 0) return null;
  return new DOMRect(page.left, page.top, page.width, (page.width * 9) / 16);
}

/** Takes a picture once a file has settled on screen, and again after it's saved. */
export function useOfficeThumb(kind: OfficeKind, path: string | null) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const take = useCallback(
    (delay: number) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const key = path?.toLowerCase();
        const entry = useApp.getState().library.documents.find((d) => d.path.toLowerCase() === key);
        const rect = pageTop(kind);
        // A dialog over the page would end up in the picture.
        if (!entry || !rect || document.querySelector("dialog[open]")) return;
        void captureThumb(rect, entry.id).then((done) => {
          if (done) useApp.getState().thumbSaved(entry.id, new Date().toISOString());
        });
      }, delay);
    },
    [kind, path],
  );

  useEffect(() => {
    const key = path?.toLowerCase();
    const entry = useApp.getState().library.documents.find((d) => d.path.toLowerCase() === key);
    if (entry && !entry.thumb) take(SETTLED_MS);
    return () => clearTimeout(timer.current);
  }, [path, take]);

  return take;
}
