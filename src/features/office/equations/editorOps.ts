/**
 * Equation pictures inside the open Word document: insert, replace and remove, each as ONE edit
 * (one undo step), through the editor's own write path. The picture is an SVG added to the
 * package in the same edit, and its run is lowered so the equation sits on the text line.
 */
import type { DocxEditorRef } from "@docx-editor.dev/react";
import type { Editor } from "@docx-editor.dev/core";
import { readOoxmlPart, withContentTypeOverride, withRelationship } from "@docx-editor.dev/core/store";
import { EQUATION_TITLE, type EquationPicture } from "../../../lib/math/docxEquations";
import { escapeXml } from "../../../lib/math/omml";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const IMAGE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const MAIN_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";

/** The parts of the editor this file uses. Its types live in the library's internal chunks. */
type Surface = NonNullable<ReturnType<typeof surfaceOf>>;
type Package = ReturnType<Surface["session"]["currentPackage"]>;
type TreeOp = Parameters<Parameters<Surface["applyAutomationOps"]>[0]>[0] extends infer _
  ? NonNullable<ReturnType<Parameters<Surface["applyAutomationOps"]>[0]>>[number]
  : never;

export function surfaceOf(ref: DocxEditorRef | null) {
  const editor = ref?.getEditor() as (Editor & { surface?: unknown }) | null | undefined;
  // `surface` is on the instance, not the Editor contract; the library documents it for hosts.
  return (editor as unknown as { surface: import("@docx-editor.dev/core").PaginatedSurface | null } | null)
    ?.surface ?? null;
}

export interface EquationAt {
  drawingId: string;
  paragraphId: string;
  offset: number;
  latex: string;
  display: boolean;
}

/** The equation picture that is selected, if one is. */
export function selectedEquation(surface: Surface): EquationAt | null {
  const state = surface.state();
  const { anchor, head } = state.selection;
  if (anchor.paragraphId !== head.paragraphId || Math.abs(anchor.offset - head.offset) !== 1) return null;
  const picture = (surface as unknown as { selectedImage?: () => unknown }).selectedImage;
  void picture;
  const offset = Math.min(anchor.offset, head.offset);
  const found = equationDrawings(surface).find((d) => d.paragraphId === anchor.paragraphId && d.offset === offset);
  return found ?? null;
}

/** Every equation picture in the part the caret is in, with where it sits. */
export function equationDrawings(surface: Surface): EquationAt[] {
  const out: EquationAt[] = [];
  const layout = surface.layout() as unknown as {
    pages: readonly { fragments?: readonly unknown[] }[];
  };
  void layout;
  const part = currentPart(surface);
  if (!part) return out;
  walk(part.root as unknown as Node, null, (node, paragraph) => {
    if (node.kind !== "drawing" || !paragraph) return;
    const docPr = findDeep(node, (n) => n.localName === "docPr");
    const title = attr(docPr, "title");
    if (!title?.startsWith(EQUATION_TITLE)) return;
    out.push({
      drawingId: node.id,
      paragraphId: paragraph.id,
      offset: offsetOf(surface, paragraph.id, node.id),
      latex: attr(docPr, "descr") ?? "",
      display: title.startsWith(EQUATION_TITLE + " (display"),
    });
  });
  return out;
}

interface Node {
  id: string;
  kind?: string;
  localName: string;
  attributes?: readonly { localName?: string; name?: string; value: string }[];
  children?: readonly Node[];
}

function walk(node: Node, paragraph: Node | null, visit: (n: Node, p: Node | null) => void) {
  const p = node.kind === "paragraph" || node.localName === "p" ? node : paragraph;
  visit(node, p);
  for (const c of node.children ?? []) if (typeof c === "object" && c && "localName" in c) walk(c, p, visit);
}

function findDeep(node: Node, test: (n: Node) => boolean): Node | null {
  if (test(node)) return node;
  for (const c of node.children ?? []) {
    if (typeof c !== "object" || !c || !("localName" in c)) continue;
    const hit = findDeep(c, test);
    if (hit) return hit;
  }
  return null;
}

function attr(node: Node | null, name: string): string | null {
  const a = node?.attributes?.find((x) => (x.localName ?? x.name) === name);
  return a ? a.value : null;
}

function currentPart(surface: Surface) {
  const scope = surface.storyScope();
  return scope.kind === "body" ? surface.session.part() : surface.session.partFor(scope);
}

/** The model offset of a drawing in its paragraph: text before it, plus one per atom. */
function offsetOf(surface: Surface, paragraphId: string, drawingId: string): number {
  const sel = surface as unknown as { drawingOffset?: (p: string, d: string) => number };
  if (sel.drawingOffset) return sel.drawingOffset(paragraphId, drawingId);
  return -1;
}

function drawingNode(xml: string) {
  const doc =
    `<w:document xmlns:w="${W}" xmlns:wp="${WP}" xmlns:a="${A}" xmlns:pic="${PIC}" xmlns:r="${R}">` +
    `<w:body><w:p><w:r>${xml}</w:r></w:p></w:body></w:document>`;
  const read = readOoxmlPart(doc, { name: "/word/penwork-equation.xml", contentType: MAIN_TYPE });
  if (!read.ok) throw new Error(`equation drawing: ${read.reason}`);
  const found = findDeep(read.part.root as unknown as Node, (n) => n.kind === "drawing");
  if (!found) throw new Error("equation drawing: none");
  return found;
}

const emu = (pt: number) => Math.max(1, Math.round(pt * 12700));

function drawingXml(relId: string, docPrId: number, latex: string, display: boolean, p: EquationPicture) {
  const cx = emu(p.widthPt);
  const cy = emu(p.heightPt);
  const title = EQUATION_TITLE + (display ? " (display)" : "");
  return (
    `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:docPr id="${docPrId}" name="Equation ${docPrId}" title="${escapeXml(title)}" descr="${escapeXml(latex)}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="${PIC}"><pic:pic><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="equation.svg"/>` +
    `<pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`
  );
}

/** The ops and package edit that put one equation picture at a place. */
function placement(surface: Surface, at: { paragraphId: string; offset: number }, latex: string, display: boolean, picture: EquationPicture) {
  const owner = currentPart(surface)?.name ?? "/word/document.xml";
  const media = `/word/media/penwork-equation-${crypto.randomUUID().slice(0, 8)}.svg`;
  const target = media.replace(/^\/word\//, "");
  const bytes = new TextEncoder().encode(picture.svg);
  const addMedia = (pkg: Package): Package => {
    const parts = new Map(pkg.partBytes);
    parts.set(media, bytes);
    return withContentTypeOverride({ ...pkg, partBytes: parts }, media, "image/svg+xml") as Package;
  };
  const planned = withRelationship(addMedia(surface.session.currentPackage()), owner, IMAGE_REL, target);
  if (!planned.ok) throw new Error("equation picture: no relationship");
  const docPrId = 0x7000_0000 + Math.floor(Math.random() * 0x0fff_ffff);
  const ops = [
    { op: "insertDrawing", paragraphId: at.paragraphId, offset: at.offset, drawing: drawingNode(drawingXml(planned.relationshipId, docPrId, latex, display, picture)) },
    {
      op: "setRunProperties",
      paragraphId: at.paragraphId,
      start: at.offset,
      end: at.offset + 1,
      properties: [{ localName: "position", attributes: { val: String(-Math.round(picture.depthPt * 2)) } }],
    },
  ] as unknown as TreeOp[];
  const edit = (pkg: Package): Package => {
    const done = withRelationship(addMedia(pkg), owner, IMAGE_REL, target);
    if (!done.ok || done.relationshipId !== planned.relationshipId) throw new Error("equation picture: relationship moved");
    return done.pkg as Package;
  };
  return { ops, edit };
}

export function insertEquation(surface: Surface, latex: string, display: boolean, picture: EquationPicture): boolean {
  const caret = surface.state().selection.head;
  const { ops, edit } = placement(surface, caret, latex, display, picture);
  const result = surface.applyAutomationOps(() => ops, surface.storyScope(), [edit]);
  return !result.rejected;
}

export function replaceEquation(surface: Surface, old: EquationAt, latex: string, display: boolean, picture: EquationPicture): boolean {
  const { ops, edit } = placement(surface, old, latex, display, picture);
  const remove = { op: "deleteDrawing", drawingNodeId: old.drawingId } as unknown as TreeOp;
  const result = surface.applyAutomationOps(() => [remove, ...ops], surface.storyScope(), [edit]);
  return !result.rejected;
}

export function removeEquation(surface: Surface, old: EquationAt): boolean {
  const remove = { op: "deleteDrawing", drawingNodeId: old.drawingId } as unknown as TreeOp;
  return !surface.applyAutomationOps(() => [remove], surface.storyScope()).rejected;
}
