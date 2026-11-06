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
 * The PDF's text styles not yet in the file. A new file shown (a tool's result, or Undo of one)
 * already has them written in, because tools read the file the way Save does, so they start over.
 */
export function useTextStyles(viewer: PDFViewer | null, dark: boolean, source: unknown) {
  const styles = useRef<TextStyles>(NO_STYLES);
  const layer = useRef<ReturnType<typeof textStyleLayer> | null>(null);

  useEffect(() => {
    styles.current = NO_STYLES;
    layer.current?.set(NO_STYLES);
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
      /** Applies (or takes off) a style; gives back whether it went on, and how to undo it. */
      apply(picked: Picked[], style: TextStyle) {
        const before = styles.current;
        const { styles: next, on } = applyStyle(before, picked, style);
        set(next);
        return {
          on,
          // Only while nothing else has changed since; a newer change isn't thrown away with it.
          undo: () => {
            if (styles.current === next) set(before);
          },
        };
      },
      /** The file with them written in, for Save and for tools. */
      bake: (bytes: Uint8Array) => bakeStyles(bytes, styles.current),
    };
  }, []);
}
