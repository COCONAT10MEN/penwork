/**
 * Equations in a .docx, both ways.
 *
 * The Word editor can only draw simple equations, so while a file is open each equation is a
 * picture of its LaTeX (typeset by MathJax), lowered onto the text line. On Save every picture
 * becomes a real Word equation (OMML) again. An equation nobody changed is written back exactly
 * as it came, and the LaTeX of each one is kept in a small custom XML part so Penwork gets the
 * user's own LaTeX back, even after the file has been through Word.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped } from "fflate";
import { OMML_NS, WML_NS, escapeXml } from "./omml";
import { ommlToLatex } from "./ommlToLatex";
import {
  A_NS,
  IMAGE_REL,
  PIC_NS,
  R_NS,
  WP_NS,
  addRelationship,
  ensureDefault,
  fingerprint,
  parse,
  readStore,
  relsDoc,
  relsPath,
  removeUnusedPictures,
  serialize,
  storyParts,
  writeStore,
} from "./docxPackage";

export { fingerprint };
/** The picture title that marks an equation, as Word's alt text shows it. */
export const EQUATION_TITLE = "Penwork equation";
const DISPLAY = " (display)";
const CENTRED = " (display, centred)";

export interface EquationPicture {
  svg: string;
  widthPt: number;
  heightPt: number;
  depthPt: number;
}

/** What an equation looked like when the file opened, so an untouched one is saved unchanged. */
export interface OriginalEquation {
  latex: string;
  omml: string;
}

export type Render = (latex: string, display: boolean, sizePt: number) => Promise<EquationPicture | null>;
/** OMML for LaTeX, or null when the LaTeX has a mistake (the picture then stays a picture). */
export type ToOmml = (latex: string, display: boolean) => string | null;

/** The size, in points, of the text an equation sits in. */
function sizeAt(node: Element, fallback: number): number {
  const sz = (rPr: Element | null | undefined) => {
    const el = rPr ? Array.from(rPr.children).find((c) => c.localName === "sz" && c.namespaceURI === WML_NS) : null;
    const v = el ? Number(el.getAttributeNS(WML_NS, "val") ?? el.getAttribute("w:val")) : NaN;
    return Number.isFinite(v) && v > 0 ? v / 2 : null;
  };
  for (const r of Array.from(node.getElementsByTagNameNS(WML_NS, "rPr"))) {
    const v = sz(r);
    if (v) return v;
  }
  let p: Element | null = node.parentElement;
  while (p && !(p.localName === "p" && p.namespaceURI === WML_NS)) p = p.parentElement;
  const pPr = p ? Array.from(p.children).find((c) => c.localName === "pPr") : undefined;
  const markRun = pPr ? Array.from(pPr.children).find((c) => c.localName === "rPr") : undefined;
  return sz(markRun) ?? fallback;
}

/** The document's normal text size, from its styles. */
function defaultSize(zip: Unzipped): number {
  const styles = zip["word/styles.xml"];
  if (!styles) return 11;
  const doc = parse(strFromU8(styles));
  const read = (scope: Element | undefined) => {
    const sz = scope?.getElementsByTagNameNS(WML_NS, "sz")[0];
    const v = sz ? Number(sz.getAttributeNS(WML_NS, "val") ?? sz.getAttribute("w:val")) : NaN;
    return Number.isFinite(v) && v > 0 ? v / 2 : null;
  };
  const normal = Array.from(doc.getElementsByTagNameNS(WML_NS, "style")).find(
    (s) => (s.getAttributeNS(WML_NS, "styleId") ?? s.getAttribute("w:styleId")) === "Normal",
  );
  const defaults = doc.getElementsByTagNameNS(WML_NS, "rPrDefault")[0];
  return read(normal) ?? read(defaults) ?? 11;
}

function inside(node: Element, ns: string, name: string): boolean {
  for (let p = node.parentElement; p; p = p.parentElement) {
    if (p.namespaceURI === ns && p.localName === name) return true;
  }
  return false;
}

function maxDocPrId(zip: Unzipped): number {
  let max = 0;
  for (const part of storyParts(zip)) {
    for (const m of strFromU8(zip[part]).matchAll(/<wp:docPr\b[^>]*\bid="(\d+)"/g)) {
      max = Math.max(max, Number(m[1]));
    }
  }
  return max;
}

const emu = (pt: number) => Math.max(1, Math.round(pt * 12700));

function pictureRun(opts: {
  relId: string;
  docPrId: number;
  key: string;
  title: string;
  latex: string;
  picture: EquationPicture;
}): string {
  const { picture: p } = opts;
  const cx = emu(p.widthPt);
  const cy = emu(p.heightPt);
  // w:position lowers the picture (in half-points) so the equation's baseline is the line's.
  const lower = Math.round(p.depthPt * 2);
  return (
    `<w:r xmlns:w="${WML_NS}"><w:rPr>${lower ? `<w:position w:val="${-lower}"/>` : ""}</w:rPr>` +
    `<w:drawing><wp:inline xmlns:wp="${WP_NS}" distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:docPr id="${opts.docPrId}" name="${escapeXml(opts.key)}" title="${escapeXml(opts.title)}" descr="${escapeXml(opts.latex)}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="${A_NS}" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="${A_NS}"><a:graphicData uri="${PIC_NS}"><pic:pic xmlns:pic="${PIC_NS}">` +
    `<pic:nvPicPr><pic:cNvPr id="${opts.docPrId}" name="${escapeXml(opts.key)}.svg"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr>` +
    `<pic:blipFill><a:blip xmlns:r="${R_NS}" r:embed="${opts.relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  );
}

function importXml(doc: Document, xml: string): Element {
  return doc.importNode(parse(xml).documentElement, true) as Element;
}

/** The paragraph's justification element, if any. */
function jcOf(paragraph: Element | null): Element | undefined {
  const pPr = paragraph ? Array.from(paragraph.children).find((c) => c.localName === "pPr" && c.namespaceURI === WML_NS) : undefined;
  return pPr ? Array.from(pPr.children).find((c) => c.localName === "jc" && c.namespaceURI === WML_NS) : undefined;
}

function setCentred(paragraph: Element) {
  const doc = paragraph.ownerDocument;
  let pPr = Array.from(paragraph.children).find((c) => c.localName === "pPr" && c.namespaceURI === WML_NS);
  if (!pPr) {
    pPr = doc.createElementNS(WML_NS, "w:pPr");
    paragraph.insertBefore(pPr, paragraph.firstChild);
  }
  const jc = doc.createElementNS(WML_NS, "w:jc");
  jc.setAttributeNS(WML_NS, "w:val", "center");
  // pPr children have a fixed order; jc comes late, before the text direction and outline items.
  const later = Array.from(pPr.children).find((c) =>
    ["textDirection", "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"].includes(c.localName),
  );
  pPr.insertBefore(jc, later ?? null);
}

/**
 * Opening: every Word equation becomes a picture of its LaTeX. Equations that can't be read as
 * LaTeX stay as they are, and the editor draws them itself.
 */
export async function equationsToPictures(
  bytes: Uint8Array,
  render: Render,
): Promise<{ bytes: Uint8Array; originals: Map<string, OriginalEquation>; count: number }> {
  const originals = new Map<string, OriginalEquation>();
  const zip = unzipSync(bytes);
  const parts = storyParts(zip);
  if (!parts.some((p) => strFromU8(zip[p]).includes(OMML_NS))) return { bytes, originals, count: 0 };
  const store = readStore(zip).map;
  const size = defaultSize(zip);
  let nextId = maxDocPrId(zip) + 1;
  let media = 0;
  for (const part of parts) {
    const xml = strFromU8(zip[part]);
    if (!xml.includes(OMML_NS)) continue;
    const doc = parse(xml);
    const all = Array.from(doc.getElementsByTagNameNS(OMML_NS, "oMathPara")).concat(
      Array.from(doc.getElementsByTagNameNS(OMML_NS, "oMath")).filter((m) => !inside(m, OMML_NS, "oMathPara")),
    );
    const rels = relsDoc(zip, part);
    let changed = false;
    for (const math of all) {
      // A deleted equation in tracked changes belongs to the revision; leave it to the editor.
      if (inside(math, WML_NS, "del") || inside(math, WML_NS, "moveFrom")) continue;
      const display = math.localName === "oMathPara";
      const first = display ? math.getElementsByTagNameNS(OMML_NS, "oMath")[0] : math;
      const stored = store.get(fingerprint(first ?? math));
      const latex = stored ?? ommlToLatex(math);
      if (!latex.trim()) continue;
      const picture = await render(latex, display, sizeAt(math, size));
      if (!picture) continue;
      media++;
      let mediaName = `word/media/penwork-equation-${media}.svg`;
      while (zip[mediaName]) mediaName = `word/media/penwork-equation-${++media}.svg`;
      zip[mediaName] = strToU8(picture.svg);
      // Every story part lives in word/, so the picture sits beside it in media/.
      const relId = addRelationship(rels, IMAGE_REL, mediaName.slice("word/".length));
      const key = `${EQUATION_TITLE} ${nextId}`;
      const paragraph = math.parentElement?.localName === "p" ? math.parentElement : null;
      let title = EQUATION_TITLE + (display ? DISPLAY : "");
      if (display && paragraph && !jcOf(paragraph)) {
        setCentred(paragraph);
        title = EQUATION_TITLE + CENTRED;
      }
      const run = importXml(doc, pictureRun({ relId, docPrId: nextId, key, title, latex, picture }));
      originals.set(key, { latex, omml: serialize(math) });
      nextId++;
      math.replaceWith(run);
      changed = true;
    }
    if (changed) {
      zip[part] = strToU8(serialize(doc));
      zip[relsPath(part)] = strToU8(serialize(rels));
    }
  }
  if (originals.size === 0) return { bytes, originals, count: 0 };
  ensureDefault(zip, "svg", "image/svg+xml");
  return { bytes: zipSync(zip), originals, count: originals.size };
}

/** The equation pictures in a part, with what each one says. */
function equationDrawings(doc: Document) {
  return Array.from(doc.getElementsByTagNameNS(WML_NS, "drawing")).flatMap((drawing) => {
    const docPr = drawing.getElementsByTagNameNS(WP_NS, "docPr")[0];
    const title = docPr?.getAttribute("title") ?? "";
    if (!title.startsWith(EQUATION_TITLE)) return [];
    const embeds = Array.from(drawing.getElementsByTagNameNS(A_NS, "blip")).map((b) => b.getAttributeNS(R_NS, "embed") ?? "");
    for (const ext of Array.from(drawing.getElementsByTagName("*"))) {
      const id = ext.localName === "svgBlip" ? ext.getAttributeNS(R_NS, "embed") : null;
      if (id) embeds.push(id);
    }
    return [
      {
        drawing,
        key: docPr.getAttribute("name") ?? "",
        latex: docPr.getAttribute("descr") ?? "",
        display: title.startsWith(EQUATION_TITLE + " (display"),
        centred: title === EQUATION_TITLE + CENTRED,
        embeds: embeds.filter(Boolean),
      },
    ];
  });
}

function paragraphOf(node: Element): Element | null {
  let p = node.parentElement;
  while (p && !(p.localName === "p" && p.namespaceURI === WML_NS)) p = p.parentElement;
  return p;
}

/** Puts `math` where `drawing` is, splitting its run if the run holds anything else. */
function replaceDrawing(drawing: Element, math: Element) {
  const runEl = drawing.parentElement;
  if (!runEl || runEl.localName !== "r") {
    drawing.replaceWith(math);
    return;
  }
  const siblings = Array.from(runEl.children);
  const at = siblings.indexOf(drawing);
  const content = (els: Element[]) => els.filter((c) => c.localName !== "rPr");
  const before = content(siblings.slice(0, at));
  const after = content(siblings.slice(at + 1));
  const parent = runEl.parentElement;
  if (!parent) return;
  if (after.length > 0) {
    const tail = runEl.cloneNode(false) as Element;
    const rPr = siblings.find((c) => c.localName === "rPr");
    if (rPr) tail.append(rPr.cloneNode(true));
    for (const c of after) tail.append(c);
    parent.insertBefore(tail, runEl.nextSibling);
  }
  parent.insertBefore(math, runEl.nextSibling);
  drawing.remove();
  if (before.length === 0) runEl.remove();
}

/**
 * Saving: every equation picture becomes a real Word equation. One whose LaTeX hasn't changed
 * since the file opened is written back exactly as it came.
 */
export function picturesToEquations(
  bytes: Uint8Array,
  originals: Map<string, OriginalEquation>,
  toOmml: ToOmml,
): { bytes: Uint8Array; count: number; failed: number } {
  const zip = unzipSync(bytes);
  const store = new Map<string, string>();
  let count = 0;
  let failed = 0;
  const dropped = new Map<string, Set<string>>();
  for (const part of storyParts(zip)) {
    const xml = strFromU8(zip[part]);
    if (!xml.includes(EQUATION_TITLE)) continue;
    const doc = parse(xml);
    const found = equationDrawings(doc);
    if (found.length === 0) continue;
    for (const eq of found) {
      const original = originals.get(eq.key);
      const omml = original && original.latex === eq.latex ? original.omml : toOmml(eq.latex, eq.display);
      if (!omml) {
        failed++;
        continue;
      }
      const math = importXml(doc, omml);
      const paragraph = paragraphOf(eq.drawing);
      replaceDrawing(eq.drawing, math);
      if (eq.centred && paragraph) {
        const jc = jcOf(paragraph);
        if ((jc?.getAttributeNS(WML_NS, "val") ?? jc?.getAttribute("w:val")) === "center") jc?.remove();
      }
      const first = math.localName === "oMathPara" ? math.getElementsByTagNameNS(OMML_NS, "oMath")[0] : math;
      store.set(fingerprint(first ?? math), eq.latex);
      for (const id of eq.embeds) {
        const set = dropped.get(part) ?? new Set<string>();
        set.add(id);
        dropped.set(part, set);
      }
      count++;
    }
    zip[part] = strToU8(serialize(doc));
  }
  if (count === 0 && store.size === 0) return { bytes, count, failed };
  removeUnusedPictures(zip, dropped);
  writeStore(zip, store);
  return { bytes: zipSync(zip), count, failed };
}

