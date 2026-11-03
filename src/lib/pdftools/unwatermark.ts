import {
  PDFDict,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFString,
  PDFHexString,
  type PDFDocument,
} from "pdf-lib";
import {
  cutSections,
  fromLatin1,
  latin1,
  markedSections,
  pageContent,
  setPageContent,
  streamBytes,
} from "./content";
import { load, save } from "./pages";

/**
 * Remove watermark: what a PDF marks as a watermark, which is how Penwork, Acrobat and most tools
 * add them. A watermark drawn as plain page content can't be told apart from the page, so it stays;
 * the count says what was found.
 */

const WATERMARK = /watermark/i;

function ocgIsWatermark(doc: PDFDocument, value: unknown): boolean {
  const ocg = value instanceof PDFRef ? doc.context.lookup(value) : value;
  if (!(ocg instanceof PDFDict)) return false;
  const name = ocg.get(PDFName.of("Name"));
  const text = name instanceof PDFString || name instanceof PDFHexString ? name.decodeText() : "";
  return WATERMARK.test(text);
}

async function cleanContent(
  doc: PDFDocument,
  text: string,
  resources: PDFDict | undefined,
): Promise<{ text: string; removed: number }> {
  const props = resources?.lookup(PDFName.of("Properties"));
  const gone = markedSections(text).filter((s) => {
    if (s.tag === "/Artifact" && /\/Subtype\s*\/Watermark/.test(s.props)) return true;
    if (s.tag === "/OC" && props instanceof PDFDict && s.props.startsWith("/"))
      return ocgIsWatermark(doc, props.get(PDFName.of(s.props.slice(1))));
    return false;
  });
  return { text: gone.length ? cutSections(text, gone) : text, removed: gone.length };
}

export async function removeWatermarks(
  bytes: Uint8Array,
): Promise<{ bytes: Uint8Array; count: number }> {
  const doc = await load(bytes);
  let count = 0;
  const doneForms = new Set<string>();
  for (const page of doc.getPages()) {
    // Watermark annotations
    const annots = page.node.Annots();
    if (annots) {
      const kept = annots.asArray().filter((a) => {
        const d = doc.context.lookup(a);
        const water =
          d instanceof PDFDict && d.get(PDFName.of("Subtype"))?.toString() === "/Watermark";
        if (water) count++;
        return !water;
      });
      page.node.set(PDFName.of("Annots"), doc.context.obj(kept));
    }
    const resources = page.node.Resources();
    const text = await pageContent(doc, page);
    if (text !== null) {
      const cleaned = await cleanContent(doc, text, resources);
      if (cleaned.removed) {
        setPageContent(doc, page, cleaned.text);
        count += cleaned.removed;
      }
    }
    // Pictures and drawings the page places: one marked as a watermark goes, and inside the
    // others, marked parts go.
    const xobjects = resources?.lookup(PDFName.of("XObject"));
    if (!(xobjects instanceof PDFDict)) continue;
    for (const [, ref] of xobjects.entries()) {
      if (!(ref instanceof PDFRef) || doneForms.has(ref.toString())) continue;
      doneForms.add(ref.toString());
      const xo = doc.context.lookup(ref);
      if (!(xo instanceof PDFRawStream)) continue;
      if (ocgIsWatermark(doc, xo.dict.get(PDFName.of("OC")))) {
        doc.context.assign(
          ref,
          doc.context.flateStream(new Uint8Array(), dictToLiteral(xo.dict) as never),
        );
        count++;
        continue;
      }
      if (xo.dict.get(PDFName.of("Subtype"))?.toString() !== "/Form") continue;
      const inner = await streamBytes(xo);
      if (!inner) continue;
      const own = xo.dict.lookup(PDFName.of("Resources"));
      const cleaned = await cleanContent(
        doc,
        latin1(inner),
        own instanceof PDFDict ? own : resources,
      );
      if (!cleaned.removed) continue;
      const dict = xo.dict.clone(doc.context);
      dict.delete(PDFName.of("Filter"));
      dict.delete(PDFName.of("DecodeParms"));
      dict.delete(PDFName.of("Length"));
      const next = doc.context.flateStream(fromLatin1(cleaned.text));
      for (const [k, v] of dict.entries()) next.dict.set(k, v);
      doc.context.assign(ref, next);
      count += cleaned.removed;
    }
  }
  return { bytes: await save(doc), count };
}

/** The entries a new stream keeps from an old one, without how its bytes were packed. */
function dictToLiteral(dict: PDFDict): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of dict.entries()) {
    const name = k.asString().slice(1);
    if (name === "Filter" || name === "DecodeParms" || name === "Length" || name === "OC") continue;
    out[name] = v;
  }
  return out;
}
