// Writes LICENSES/office-libraries.txt: every package the Word, Excel and PDF editors ship, with
// its licence text. MIT and Apache-2.0 both require that text to travel with copies of the code.
// Stops with an error on any licence that isn't on the allowed list. Run after changing these.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOTS = [
  "pdfjs-dist",
  "@docx-editor.dev/react",
  "@docx-editor.dev/core",
  "@fortune-sheet/react",
  "@fortune-sheet/core",
  "@corbe30/fortune-excel",
  "exceljs",
  "pdf-lib",
];
const ALLOWED = /^\(?(MIT|ISC|Apache-2\.0|BSD-[23]-Clause|0BSD|Unlicense|Zlib|BlueOak-1\.0\.0)/;
// jszip offers a choice of two licences, and Penwork takes the MIT one.
const CHOSEN = { jszip: "MIT" };
// Only used by exceljs when it runs in Node. The browser build Penwork ships doesn't contain it.
const NOT_SHIPPED = ["buffers"];
// Published without a licence file, so the text comes from the project's own repository.
const STORED = { "@fortune-sheet/": "LICENSES/fortune-sheet-MIT.txt" };

function packageDir(name, from) {
  const nested = join(from, "node_modules", name);
  return existsSync(nested) ? nested : join("node_modules", name);
}

const found = new Map();
function visit(name, from) {
  const dir = packageDir(name, from);
  const file = join(dir, "package.json");
  if (!existsSync(file)) return;
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  const key = `${pkg.name}@${pkg.version}`;
  if (found.has(key)) return;
  found.set(key, { pkg, dir });
  for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep, dir);
}
ROOTS.forEach((name) => visit(name, "."));

function licenceText(pkg, dir) {
  const name = readdirSync(dir).find((f) => /^(licen[cs]e|copying)/i.test(f));
  if (name) return readFileSync(join(dir, name), "utf8");
  const stored = Object.entries(STORED).find(([prefix]) => pkg.name.startsWith(prefix));
  return stored ? readFileSync(stored[1], "utf8") : null;
}

const parts = [];
const problems = [];
for (const [key, { pkg, dir }] of [...found].sort(([a], [b]) => a.localeCompare(b))) {
  if (pkg.name.startsWith("@types/") || NOT_SHIPPED.includes(pkg.name)) continue;
  const licence = CHOSEN[pkg.name] ?? pkg.license ?? pkg.licenses?.[0]?.type ?? "unknown";
  if (!ALLOWED.test(licence)) problems.push(`${key}: ${licence}`);
  const text = licenceText(pkg, dir);
  parts.push(
    `${"=".repeat(78)}\n${key}\nLicense: ${licence}\n\n${text ?? "(no licence text in the package)"}\n`,
  );
}
if (problems.length > 0) {
  console.error(`Licences to look at:\n${problems.join("\n")}`);
  process.exit(1);
}

for (const file of readdirSync("node_modules/pdfjs-dist/wasm")) {
  if (!file.startsWith("LICENSE")) continue;
  const text = readFileSync(`node_modules/pdfjs-dist/wasm/${file}`, "utf8");
  parts.push(`${"=".repeat(78)}\nInside pdf.js: ${file}\n\n${text}\n`);
}
for (const file of readdirSync("node_modules/@docx-editor.dev/core/licenses")) {
  const text = readFileSync(`node_modules/@docx-editor.dev/core/licenses/${file}`, "utf8");
  parts.push(`${"=".repeat(78)}\nInside @docx-editor.dev/core: ${file}\n\n${text}\n`);
}

mkdirSync("LICENSES", { recursive: true });
writeFileSync("LICENSES/office-libraries.txt", parts.join("\n"));
console.log(`${found.size} packages listed`);
