import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useEffect, useMemo, useRef } from "react";
import { pageEditLayer } from "./pageEditLayer";
import {
  applyStyle,
  bakeEdits,
  NO_EDITS,
  withFaces,
  type PageEdits,
  type Picked,
  type TextStyle,
} from "./pageEdits";

/**
 * The PDF's edits not yet in the file. A new file shown (a tool's result) already has them written
 * in, because tools read the file the way Save does, so they start over; undoing that tool shows the
 * file from before it, with the edits it had then put back.
 */
export function usePageEdits(viewer: PDFViewer | null, dark: boolean, source: unknown) {
  const edits = useRef<PageEdits>(NO_EDITS);
  const layer = useRef<ReturnType<typeof pageEditLayer> | null>(null);
  const restore = useRef<{ source: unknown; edits: PageEdits } | null>(null);

  useEffect(() => {
    const back = restore.current;
    restore.current = null;
    edits.current = back && back.source === source ? back.edits : NO_EDITS;
    layer.current?.set(edits.current);
  }, [source]);

  useEffect(() => {
    if (!viewer) return;
    const drawn = pageEditLayer(viewer, dark);
    drawn.set(edits.current);
    layer.current = drawn;
    return () => {
      drawn.destroy();
      if (layer.current === drawn) layer.current = null;
    };
  }, [viewer, dark]);

  return useMemo(() => {
    const set = (next: PageEdits) => {
      edits.current = next;
      layer.current?.set(next);
    };
    return {
      /**
       * Applies (or takes off) a style, in the words' own font where it's installed: whether it
       * went on, and the edits before and after.
       */
      async style(picked: Picked[], style: TextStyle) {
        const before = edits.current;
        const { edits: styled, on } = applyStyle(before, picked, style);
        const after = await withFaces(styled);
        // Something else may have changed while the faces were found; this goes on top of it.
        const now = edits.current;
        const merged = now === before ? after : { ...now, words: after.words, lines: after.lines };
        set(merged);
        return { on, before: now, after: merged };
      },
      /** Any other change: the edits before and after it. */
      change(make: (e: PageEdits) => PageEdits) {
        const before = edits.current;
        const after = make(before);
        set(after);
        return { before, after };
      },
      set,
      snapshot: () => edits.current,
      /** These edits go with `source` when it's shown next, instead of none. */
      restoreWith: (source: unknown, next: PageEdits) => {
        restore.current = { source, edits: next };
      },
      /** The file with them written in, for Save and for tools. */
      bake: (bytes: Uint8Array) => bakeEdits(bytes, edits.current),
    };
  }, []);
}

export type PageEditsApi = ReturnType<typeof usePageEdits>;
