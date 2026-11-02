// pdf.js loads these at run time. The app has to work offline, so they ship inside it.
import { cpSync, mkdirSync } from "node:fs";

const from = "node_modules/pdfjs-dist";
const to = "public/pdfjs";
mkdirSync(to, { recursive: true });
for (const folder of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  cpSync(`${from}/${folder}`, `${to}/${folder}`, { recursive: true });
}
