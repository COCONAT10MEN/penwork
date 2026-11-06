import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useEffect, useMemo, useRef } from "react";
import { textStyleLayer } from "./textStyleLayer";
import {
  applyStyle,
  bakeStyles,
  NO_STYLES,
  type Picked,
  type TextStyle,
  type TextStyles,
} from "./textStyles";

/**
 * The PDF's text styles not yet in the file. A new file shown (a tool's result) already has them
 * written in, because tools read the file the way Save does, so they start over; undoing that tool
 * shows the file from before it, with the styles it had then put back.
 */
export function useTextStyles(viewer: PDFViewer | null, dark: boolean, source: unknown) {
  const styles = useRef<TextStyles>(NO_STYLES);
  const layer = useRef<ReturnType<typeof textStyleLayer> | null>(null);
  const restore = useRef<{ source: unknown; styles: TextStyles } | null>(null);

  useEffect(() => {
    const back = restore.current;
    restore.current = null;
    styles.current = back && back.source === source ? back.styles : NO_STYLES;
    layer.current?.set(styles.current);
  }, [source]);

  useEffect(() => {
    if (!viewer) return;
    const drawn = textStyleLayer(viewer, dark);
    drawn.set(styles.current);
    layer.current = drawn;
    return () => {
      drawn.destroy();
      if (layer.current === drawn) layer.current = null;
    };
  }, [viewer, dark]);

  return useMemo(() => {
    const set = (next: TextStyles) => {
      styles.current = next;
      layer.current?.set(next);
    };
    return {
      /** Applies (or takes off) a style: whether it went on, and the styles before and after. */
      apply(picked: Picked[], style: TextStyle) {
        const before = styles.current;
        const { styles: after, on } = applyStyle(before, picked, style);
        set(after);
        return { on, before, after };
      },
      set,
      snapshot: () => styles.current,
      /** These styles go with `source` when it's shown next, instead of none. */
      restoreWith: (source: unknown, next: TextStyles) => {
        restore.current = { source, styles: next };
      },
      /** The file with them written in, for Save and for tools. */
      bake: (bytes: Uint8Array) => bakeStyles(bytes, styles.current),
    };
  }, []);
}
