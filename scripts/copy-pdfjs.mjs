// Files the app loads at run time and has to ship inside it, because it must work offline:
// pdf.js's fonts, maps and wasm, and the PDF reader's page (src/reader) with the slide engine it runs.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const pdfjs = "node_modules/pdfjs-dist";
mkdirSync("public/pdfjs", { recursive: true });
for (const folder of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  cpSync(`${pdfjs}/${folder}`, `public/pdfjs/${folder}`, { recursive: true });
}

const reader = "public/reader";
mkdirSync(reader, { recursive: true });
for (const file of ["engine.js", "engine.css", "app.css"]) {
  cpSync(`src/runtime/${file}`, `${reader}/${file}`);
}
for (const file of ["reader.html", "reader.css"]) {
  cpSync(`src/reader/${file}`, `${reader}/${file}`);
}
cpSync(`${pdfjs}/web/pdf_viewer.css`, `${reader}/pdf_viewer.css`);
cpSync(`${pdfjs}/web/images`, `${reader}/images`, { recursive: true });
// The same wrapping as the presentation page (FREEHAND_JS in session.rs): the page has no modules.
const freehand = readFileSync("node_modules/perfect-freehand/dist/cjs/index.js", "utf8");
writeFileSync(
  `${reader}/freehand.js`,
  `(function(){var module={exports:{}},exports=module.exports;\n${freehand}\n;window.__pf=module.exports;})();`,
);
