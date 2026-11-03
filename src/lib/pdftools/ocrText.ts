import { PDFName, PDFString, type PDFDocument, type PDFRef } from "pdf-lib";
import { drawOnTop } from "./content";
import { load, save } from "./pages";

/**
 * OCR's result: the words found on a scanned page, written over it as invisible text in the right
 * places, so it can be searched, selected and copied while the page looks exactly the same.
 *
 * The font is "glyphless", as OCRmyPDF does it: every character code stands for a Unicode
 * character through the font's ToUnicode map, and nothing is ever drawn, so any language works
 * without carrying a font for it.
 */

export interface OcrWord {
  text: string;
  /** In the page's own coordinates: where its baseline starts, and its size along and across. */
  x: number;
  y: number;
  width: number;
  height: number;
}

const hex4 = (n: number) => n.toString(16).padStart(4, "0");

function glyphlessFont(doc: PDFDocument, chars: string[]): PDFRef {
  // ToUnicode: code n is chars[n - 1]. Characters outside the basic plane go as surrogate pairs.
  const lines: string[] = [];
  chars.forEach((ch, i) => {
    const units = [...ch].flatMap((c) => {
      const cp = c.codePointAt(0) ?? 32;
      if (cp < 0x10000) return [cp];
      const v = cp - 0x10000;
      return [0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff)];
    });
    lines.push(`<${hex4(i + 1)}> <${units.map(hex4).join("")}>`);
  });
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += 100) {
    const part = lines.slice(i, i + 100);
    chunks.push(`${part.length} beginbfchar\n${part.join("\n")}\nendbfchar`);
  }
  const cmap = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Penwork-OCR def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
${chunks.join("\n")}
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;
  const toUnicode = doc.context.register(doc.context.flateStream(cmap));
  const descendant = doc.context.register(
    doc.context.obj({
      Type: "Font",
      Subtype: "CIDFontType2",
      BaseFont: "GlyphLessFont",
      CIDToGIDMap: "Identity",
      CIDSystemInfo: {
        Registry: PDFString.of("Adobe"),
        Ordering: PDFString.of("Identity"),
        Supplement: 0,
      },
      FontDescriptor: doc.context.register(
        doc.context.obj({
          Type: "FontDescriptor",
          FontName: "GlyphLessFont",
          Flags: 5,
          FontBBox: [0, 0, 500, 1000],
          ItalicAngle: 0,
          Ascent: 1000,
          Descent: 0,
          CapHeight: 1000,
          StemV: 80,
        }),
      ),
      DW: 500,
    }),
  );
  return doc.context.register(
    doc.context.obj({
      Type: "Font",
      Subtype: "Type0",
      BaseFont: "GlyphLessFont",
      Encoding: "Identity-H",
      DescendantFonts: [descendant],
      ToUnicode: toUnicode,
    }),
  );
}

export async function addOcrText(
  bytes: Uint8Array,
  /** `turn` is the page's own: words run along the page as it is seen. */
  pages: { page: number; words: OcrWord[]; turn?: number }[],
): Promise<Uint8Array> {
  const doc = await load(bytes);
  const all = doc.getPages();
  for (const p of pages) {
    const page = all[p.page - 1];
    if (!page || p.words.length === 0) continue;
    const chars: string[] = [];
    const codes = new Map<string, number>();
    const code = (ch: string) => {
      let c = codes.get(ch);
      if (!c) {
        chars.push(ch);
        c = chars.length;
        codes.set(ch, c);
      }
      return c;
    };
    const t = ((p.turn ?? 0) * Math.PI) / 180;
    const c = +Math.cos(t).toFixed(6);
    const s = +Math.sin(t).toFixed(6);
    let ops = "BT 3 Tr\n";
    for (const w of p.words) {
      const letters = [...w.text];
      if (!letters.length || w.width <= 0 || w.height <= 0) continue;
      const size = w.height;
      // Each glyph is half the size wide; stretched so the word spans its box exactly.
      const natural = letters.length * size * 0.5;
      const stretch = Math.max(1, Math.min(10000, (w.width / natural) * 100));
      const hex = [...letters, " "].map((ch) => hex4(code(ch))).join("");
      ops += `/PwOcr ${size.toFixed(2)} Tf ${stretch.toFixed(2)} Tz ${c} ${s} ${-s} ${c} ${w.x.toFixed(2)} ${w.y.toFixed(2)} Tm <${hex}> Tj\n`;
    }
    ops += "ET";
    const font = glyphlessFont(doc, chars);
    const resources = page.node.normalizedEntries().Resources;
    const fonts = resources.lookup(PDFName.of("Font"));
    if (fonts && "set" in fonts)
      (fonts as { set: (k: PDFName, v: PDFRef) => void }).set(PDFName.of("PwOcr"), font);
    else resources.set(PDFName.of("Font"), doc.context.obj({ PwOcr: font }));
    drawOnTop(doc, page, ops);
  }
  return save(doc);
}
