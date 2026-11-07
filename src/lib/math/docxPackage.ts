/** The .docx package side of equations: parts, relationships, content types, the LaTeX store. */
import { strFromU8, strToU8, type Unzipped } from "fflate";
import { OMML_NS, escapeXml } from "./omml";

export const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export const WP_NS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
export const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
export const PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture";
export const PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
export const CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types";
export const IMAGE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
export const CUSTOM_XML_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml";
export const PROPS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXmlProps";
export const DS_NS = "http://schemas.openxmlformats.org/officeDocument/2006/customXml";
export const STORE_NS = "urn:penwork:equations";

export const parser = () => new DOMParser();
export const serialize = (node: Node) => new XMLSerializer().serializeToString(node);

export function parse(xml: string): Document {
  return parser().parseFromString(xml, "application/xml");
}

/** The parts that hold text: body, headers, footers, footnotes, endnotes, comments. */
export function storyParts(zip: Unzipped): string[] {
  return Object.keys(zip).filter((name) =>
    /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/.test(name),
  );
}

export function relsPath(part: string): string {
  const slash = part.lastIndexOf("/");
  return `${part.slice(0, slash)}/_rels/${part.slice(slash + 1)}.rels`;
}

export function relsDoc(zip: Unzipped, part: string): Document {
  const path = relsPath(part);
  return parse(
    zip[path]
      ? strFromU8(zip[path])
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PKG_REL_NS}"/>`,
  );
}

export function ensureDefault(zip: Unzipped, extension: string, type: string) {
  const types = parse(strFromU8(zip["[Content_Types].xml"]));
  const has = Array.from(types.getElementsByTagNameNS(CT_NS, "Default")).some(
    (d) => d.getAttribute("Extension")?.toLowerCase() === extension,
  );
  if (has) return;
  const item = types.createElementNS(CT_NS, "Default");
  item.setAttribute("Extension", extension);
  item.setAttribute("ContentType", type);
  types.documentElement.insertBefore(item, types.documentElement.firstChild);
  zip["[Content_Types].xml"] = strToU8(serialize(types));
}

export function ensureOverride(zip: Unzipped, part: string, type: string) {
  const types = parse(strFromU8(zip["[Content_Types].xml"]));
  const has = Array.from(types.getElementsByTagNameNS(CT_NS, "Override")).some(
    (d) => d.getAttribute("PartName") === `/${part}`,
  );
  if (has) return;
  const item = types.createElementNS(CT_NS, "Override");
  item.setAttribute("PartName", `/${part}`);
  item.setAttribute("ContentType", type);
  types.documentElement.append(item);
  zip["[Content_Types].xml"] = strToU8(serialize(types));
}

/** A short id for an equation's structure and text, ignoring how Word formats it. */
export function fingerprint(omml: Element): string {
  const parts: string[] = [];
  const walk = (node: Element) => {
    if (node.namespaceURI !== OMML_NS) return;
    if (node.localName.endsWith("Pr")) return;
    if (node.localName === "t") {
      parts.push(`"${node.textContent ?? ""}"`);
      return;
    }
    parts.push(node.localName);
    for (const c of Array.from(node.children)) walk(c);
    parts.push("/");
  };
  walk(omml);
  // FNV-1a, 32 bits, written twice over with different seeds to make collisions unlikely.
  const text = parts.join(" ");
  const hash = (seed: number) => {
    let h = seed;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return hash(0x811c9dc5) + hash(0x5bd1e995);
}

/** The LaTeX Penwork saved for each equation, by fingerprint. */
export function readStore(zip: Unzipped): { map: Map<string, string>; part: string | null } {
  const map = new Map<string, string>();
  for (const name of Object.keys(zip)) {
    if (!/^customXml\/item\d+\.xml$/.test(name)) continue;
    const doc = parse(strFromU8(zip[name]));
    if (doc.documentElement.namespaceURI !== STORE_NS) continue;
    for (const eq of Array.from(doc.getElementsByTagNameNS(STORE_NS, "eq"))) {
      const key = eq.getAttribute("key");
      if (key) map.set(key, eq.textContent ?? "");
    }
    return { map, part: name };
  }
  return { map, part: null };
}

export function writeStore(zip: Unzipped, entries: Map<string, string>) {
  let { part } = readStore(zip);
  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><pw:equations xmlns:pw="${STORE_NS}">` +
    [...entries].map(([key, latex]) => `<pw:eq key="${key}">${escapeXml(latex)}</pw:eq>`).join("") +
    `</pw:equations>`;
  if (part) {
    zip[part] = strToU8(xml);
    return;
  }
  if (entries.size === 0) return;
  let n = 1;
  while (zip[`customXml/item${n}.xml`]) n++;
  part = `customXml/item${n}.xml`;
  const props = `customXml/itemProps${n}.xml`;
  zip[part] = strToU8(xml);
  const id = crypto.randomUUID().toUpperCase();
  zip[props] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="no"?><ds:datastoreItem ds:itemID="{${id}}" xmlns:ds="${DS_NS}"><ds:schemaRefs/></ds:datastoreItem>`,
  );
  zip[`customXml/_rels/item${n}.xml.rels`] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Type="${PROPS_REL}" Target="itemProps${n}.xml"/></Relationships>`,
  );
  ensureOverride(zip, props, "application/vnd.openxmlformats-officedocument.customXmlProperties+xml");
  const rels = relsDoc(zip, "word/document.xml");
  addRelationship(rels, CUSTOM_XML_REL, `../${part}`);
  zip[relsPath("word/document.xml")] = strToU8(serialize(rels));
}

export function addRelationship(rels: Document, type: string, target: string): string {
  const taken = new Set(Array.from(rels.documentElement.children).map((r) => r.getAttribute("Id")));
  let n = 1;
  while (taken.has(`rIdPwEq${n}`)) n++;
  const rel = rels.createElementNS(PKG_REL_NS, "Relationship");
  rel.setAttribute("Id", `rIdPwEq${n}`);
  rel.setAttribute("Type", type);
  rel.setAttribute("Target", target);
  rels.documentElement.append(rel);
  return `rIdPwEq${n}`;
}


/** Drops the picture files the equations used, unless something else still shows them. */
export function removeUnusedPictures(zip: Unzipped, dropped: Map<string, Set<string>>) {
  for (const [part, ids] of dropped) {
    const xml = strFromU8(zip[part]);
    const rels = relsDoc(zip, part);
    for (const rel of Array.from(rels.documentElement.children)) {
      const id = rel.getAttribute("Id") ?? "";
      if (!ids.has(id) || xml.includes(`"${id}"`)) continue;
      const target = rel.getAttribute("Target") ?? "";
      rel.remove();
      const media = target.startsWith("/") ? target.slice(1) : `${part.slice(0, part.lastIndexOf("/") + 1)}${target}`;
      const normal = media.replace(/[^/]+\/\.\.\//g, "");
      const stillUsed = Object.keys(zip).some(
        (name) => name.endsWith(".rels") && name !== relsPath(part) && strFromU8(zip[name]).includes(normal.split("/").pop() ?? "\u0000"),
      );
      if (!stillUsed && /^word\/media\//.test(normal)) delete zip[normal];
    }
    zip[relsPath(part)] = strToU8(serialize(rels));
  }
}
