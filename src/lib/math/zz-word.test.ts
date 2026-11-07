// @vitest-environment jsdom
// Temporary: writes a .docx of Penwork-made equations for checking in Microsoft Word.
import { writeFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";
import { it } from "vitest";
import { texToMathml, texToSvg } from "./mathjax";
import { mathmlToOmml } from "./mathmlToOmml";
import { equationsToPictures, picturesToEquations } from "./docxEquations";

const OUT = process.env.PW_WORD_OUT;
const LIST: [string, boolean][] = (process.env.PW_LIST ?? "").split("\n").filter(Boolean).map((l) => [l.slice(2), l[0] === "D"]);

it("writes", async () => {
  if (!OUT) return;
  const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml").documentElement;
  const toOmml = (latex: string, display: boolean) => {
    const mml = texToMathml(latex, display);
    return mml.ok ? mathmlToOmml(parse(mml.value), display) : null;
  };
  // Start from pictures, as a document edited in Penwork would hold them.
  const body = LIST.map(([latex, display], i) => {
    const omml = toOmml(latex, display) ?? "";
    return display ? `<w:p>${omml}</w:p>` : `<w:p><w:r><w:t xml:space="preserve">${i + 1}. Inline </w:t></w:r>${omml}<w:r><w:t xml:space="preserve"> end.</w:t></w:r></w:p>`;
  }).join("");
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const file = zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    "word/document.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${body}<w:sectPr/></w:body></w:document>`),
  });
  // Through the open and save steps, with every equation treated as edited.
  const opened = await equationsToPictures(file, async (latex, display, size) => {
    const r = await texToSvg(latex, display);
    return r.ok ? { svg: r.value.svg, widthPt: r.value.width * size, heightPt: r.value.height * size, depthPt: r.value.depth * size } : null;
  });
  const saved = picturesToEquations(opened.bytes, new Map(), toOmml);
  writeFileSync(OUT, saved.bytes);
  console.log("equations", opened.count, saved.count, saved.failed);
});
