import { PDFName, PDFRef, type PDFDocument } from "pdf-lib";
import { load, save } from "./pages";
import { hexColor } from "./stamp";

/**
 * Highlight, underline and strike through selected text, as the PDF's own text markup: readers
 * show them, list them as comments, and can remove them again. Each carries an appearance, so they
 * look the same everywhere.
 */

export type MarkKind = "highlight" | "underline" | "strike";

export interface Mark {
  page: number;
  kind: MarkKind;
  color: string;
  /** One box per line of selected text, as [x0, y0, x1, y1] in the page's own coordinates. */
  boxes: [number, number, number, number][];
}

const SUBTYPE: Record<MarkKind, string> = {
  highlight: "Highlight",
  underline: "Underline",
  strike: "StrikeOut",
};
const n = (v: number) => +v.toFixed(2);

function appearance(doc: PDFDocument, m: Mark, rect: number[]): PDFRef {
  const { red, green, blue } = hexColor(m.color) as unknown as {
    red: number;
    green: number;
    blue: number;
  };
  let ops = "";
  for (const [x0, y0, x1, y1] of m.boxes) {
    const h = y1 - y0;
    if (m.kind === "highlight") ops += `${n(x0)} ${n(y0)} ${n(x1 - x0)} ${n(h)} re f\n`;
    else {
      const thick = Math.max(0.6, h * 0.07);
      const y = m.kind === "underline" ? y0 + h * 0.08 : y0 + h * 0.45;
      ops += `${n(x0)} ${n(y)} ${n(x1 - x0)} ${n(thick)} re f\n`;
    }
  }
  const state = doc.context.obj({
    Type: "ExtGState",
    BM: m.kind === "highlight" ? "Multiply" : "Normal",
  });
  return doc.context.register(
    doc.context.stream(`/M0 gs ${n(red)} ${n(green)} ${n(blue)} rg\n${ops}`, {
      Type: "XObject",
      Subtype: "Form",
      BBox: rect,
      Resources: { ExtGState: { M0: state } },
    }),
  );
}

export async function addMarks(bytes: Uint8Array, marks: Mark[]): Promise<Uint8Array> {
  const doc = await load(bytes);
  const pages = doc.getPages();
  for (const m of marks) {
    const page = pages[m.page - 1];
    if (!page || !m.boxes.length) continue;
    const rect = [
      Math.min(...m.boxes.map((b) => b[0])),
      Math.min(...m.boxes.map((b) => b[1])),
      Math.max(...m.boxes.map((b) => b[2])),
      Math.max(...m.boxes.map((b) => b[3])),
    ].map(n);
    const { red, green, blue } = hexColor(m.color) as unknown as {
      red: number;
      green: number;
      blue: number;
    };
    const annot = doc.context.register(
      doc.context.obj({
        Type: "Annot",
        Subtype: SUBTYPE[m.kind],
        Rect: rect,
        // Upper-left, upper-right, lower-left, lower-right of each box, as the spec orders them.
        QuadPoints: m.boxes.flatMap(([x0, y0, x1, y1]) => [x0, y1, x1, y1, x0, y0, x1, y0].map(n)),
        C: [red, green, blue].map(n),
        F: 4,
        AP: { N: appearance(doc, m, rect) },
      }),
    );
    const annots = page.node.Annots();
    if (annots) annots.push(annot);
    else page.node.set(PDFName.of("Annots"), doc.context.obj([annot]));
  }
  return save(doc);
}
