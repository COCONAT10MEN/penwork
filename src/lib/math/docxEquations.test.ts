// @vitest-environment jsdom
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { equationsToPictures, picturesToEquations, type Render } from "./docxEquations";

const M = "http://schemas.openxmlformats.org/officeDocument/2006/math";
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// As Word writes them: an inline fraction in a sentence, and a display sum on its own line.
const INLINE = `<m:oMath><m:f><m:fPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:i/></w:rPr></m:ctrlPr></m:fPr><m:num><m:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr><m:t>a</m:t></m:r></m:num><m:den><m:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr><m:t>b</m:t></m:r></m:den></m:f></m:oMath>`;
const DISPLAY = `<m:oMathPara><m:oMath><m:nary><m:naryPr><m:chr m:val="∑"/><m:limLoc m:val="undOvr"/></m:naryPr><m:sub><m:r><m:t>i=1</m:t></m:r></m:sub><m:sup><m:r><m:t>n</m:t></m:r></m:sup><m:e><m:r><m:t>i</m:t></m:r></m:e></m:nary></m:oMath></m:oMathPara>`;

function wordFile(): Uint8Array {
  const body =
    `<w:p><w:r><w:t xml:space="preserve">Half of it: </w:t></w:r>${INLINE}<w:r><w:t xml:space="preserve"> done.</w:t></w:r></w:p>` +
    `<w:p>${DISPLAY}</w:p>`;
  return zipSync({
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    ),
    "word/document.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}" xmlns:m="${M}"><w:body>${body}<w:sectPr/></w:body></w:document>`,
    ),
  });
}

const render: Render = async (latex) => ({
  svg: `<svg xmlns="http://www.w3.org/2000/svg"><title>${latex.replace(/[<&]/g, "")}</title></svg>`,
  widthPt: 20,
  heightPt: 14,
  depthPt: 4,
});

const docXml = (bytes: Uint8Array) => strFromU8(unzipSync(bytes)["word/document.xml"]);

describe("equations in a Word file", () => {
  it("opens each equation as a lowered picture that carries its LaTeX", async () => {
    const opened = await equationsToPictures(wordFile(), render);
    expect(opened.count).toBe(2);
    const xml = docXml(opened.bytes);
    expect(xml).not.toContain("oMath");
    expect(xml).toContain('descr="\\frac{a}{b}"');
    expect(xml).toContain('title="Penwork equation"');
    expect(xml).toContain('title="Penwork equation (display, centred)"');
    expect(xml).toContain('<w:position w:val="-8"/>');
    expect(xml).toContain('<w:jc w:val="center"/>');
    const files = unzipSync(opened.bytes);
    expect(Object.keys(files).filter((f) => f.endsWith(".svg"))).toHaveLength(2);
    expect(strFromU8(files["[Content_Types].xml"])).toContain('Extension="svg"');
  });

  it("saves untouched equations exactly as Word wrote them", async () => {
    const opened = await equationsToPictures(wordFile(), render);
    const saved = picturesToEquations(opened.bytes, opened.originals, () => {
      throw new Error("an untouched equation was rebuilt");
    });
    expect(saved.count).toBe(2);
    const xml = docXml(saved.bytes);
    expect(xml).toContain(`<w:t xml:space="preserve">Half of it: </w:t></w:r><m:oMath`);
    expect(xml).toContain("<m:t>a</m:t>");
    expect(xml).toContain("<m:oMathPara");
    expect(xml).not.toContain("<w:drawing");
    expect(xml).not.toContain("<w:jc");
    const files = unzipSync(saved.bytes);
    expect(Object.keys(files).filter((f) => f.endsWith(".svg"))).toHaveLength(0);
    // The LaTeX travels with the file for the next time Penwork opens it.
    const store = Object.keys(files).find((f) => /^customXml\/item\d+\.xml$/.test(f));
    expect(store && strFromU8(files[store])).toContain("\\frac{a}{b}");
    expect(strFromU8(files["word/_rels/document.xml.rels"])).toContain("customXml");
  });

  it("rebuilds a changed equation from its new LaTeX", async () => {
    const opened = await equationsToPictures(wordFile(), render);
    const changed = strToU8(docXml(opened.bytes).replace('descr="\\frac{a}{b}"', 'descr="\\sqrt{2}"'));
    const files = unzipSync(opened.bytes);
    files["word/document.xml"] = changed;
    const asked: string[] = [];
    const saved = picturesToEquations(zipSync(files), opened.originals, (latex, display) => {
      asked.push(`${latex}|${display}`);
      return `<m:oMath xmlns:m="${M}"><m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e><m:r><m:t>2</m:t></m:r></m:e></m:rad></m:oMath>`;
    });
    expect(asked).toEqual(["\\sqrt{2}|false"]);
    expect(docXml(saved.bytes)).toContain("<m:rad>");
  });

  it("gives back the user's own LaTeX when the file opens again", async () => {
    const opened = await equationsToPictures(wordFile(), render);
    const typed = strToU8(docXml(opened.bytes).replace('descr="\\frac{a}{b}"', 'descr="\\dfrac a b"'));
    const files = unzipSync(opened.bytes);
    files["word/document.xml"] = typed;
    // Pretend \dfrac a b came out as the very same fraction Word had.
    const saved = picturesToEquations(zipSync(files), opened.originals, () => INLINE.replace("<m:oMath>", `<m:oMath xmlns:m="${M}" xmlns:w="${W}">`));
    const again = await equationsToPictures(saved.bytes, render);
    expect(docXml(again.bytes)).toContain('descr="\\dfrac a b"');
  });

  it("leaves a file without equations alone", async () => {
    const plain = zipSync({ "word/document.xml": strToU8(`<w:document xmlns:w="${W}"/>`) });
    const opened = await equationsToPictures(plain, render);
    expect(opened.bytes).toBe(plain);
    expect(picturesToEquations(plain, new Map(), () => null).bytes).toBe(plain);
  });
});
