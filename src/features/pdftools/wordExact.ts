import type { Line, PageLayout, Run } from "../../lib/pdftools/pageLayout";

/**
 * "Keep the look" pages for PDF to Word: the page's art is a picture behind the text (see
 * wordExport.ts), and its text sits on it in text boxes exactly where it was: one box a paragraph,
 * one Word paragraph a line, each line on its own baseline and at its own start, each run in its
 * own font, size, colour, weight and slant, and as wide as it was (a stand-in font is squeezed or
 * stretched to the old width). Written as Word writes text boxes (DrawingML, with Word's
 * compatibility wrapper), since the docx library only writes the older VML kind.
 */

const EMU = 12700;
const emu = (pt: number) => Math.round(pt * EMU);
const tw = (pt: number) => Math.round(pt * 20);
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Word puts the baseline of a line with exact spacing this far above the line's bottom. */
const DESCENT = 0.22;

let measure: CanvasRenderingContext2D | null = null;
/** How wide text is drawn in a font on this PC, in points. */
function widthOf(r: Run): number {
  measure ??= document.createElement("canvas").getContext("2d");
  if (!measure) return 0;
  measure.font = `${r.italic ? "italic " : ""}${r.bold ? "700 " : ""}100px "${r.font}"`;
  return (measure.measureText(r.text).width * r.size) / 100;
}

function runXml(r: Run, width?: number): string {
  const size = Math.max(2, Math.round(r.size * 2));
  // Squeezed or stretched to the width it had, within reason, when a stand-in font is wider.
  // Fitted to the width it had: narrower letters for a stand-in font that's wider, and more space
  // between letters for text that was spaced out (as headings in capitals often are).
  let scale = 100;
  let spacing = 0;
  if (width && r.text.trim()) {
    // The width on the page is of the letters; a space put in before them isn't counted.
    const letters = r.text.trimStart();
    const drawn = widthOf({ ...r, text: letters });
    const ratio = drawn > 0 ? width / drawn : 1;
    if (ratio > 1.06 && letters.length > 1)
      spacing = Math.min(r.size * 0.6, (width - drawn) / (letters.length - 1));
    else if (ratio < 0.97) scale = Math.round(Math.max(66, ratio * 100));
  }
  const props = [
    `<w:rFonts w:ascii="${esc(r.font)}" w:hAnsi="${esc(r.font)}" w:cs="${esc(r.font)}" w:eastAsia="${esc(r.font)}"/>`,
    r.bold ? "<w:b/><w:bCs/>" : "",
    r.italic ? "<w:i/><w:iCs/>" : "",
    r.color !== "#000000" ? `<w:color w:val="${r.color.slice(1)}"/>` : "",
    spacing ? `<w:spacing w:val="${tw(spacing)}"/>` : "",
    scale !== 100 ? `<w:w w:val="${scale}"/>` : "",
    r.rise ? `<w:position w:val="${Math.round(r.rise * 2)}"/>` : "",
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`,
  ].join(""); // In the order Word's schema has them.
  return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
}

/**
 * A line's runs, cut where its words were far apart on the page, so each stretch can be put back
 * where it was. One run of even width drifts: a root sign drawn as a shape between "2 :" and "2"
 * leaves a wide gap the text alone doesn't have, and the numbers after it land off their signs.
 */
function placed(line: Line): Run[] {
  return line.runs.flatMap((r) => {
    if (!r.parts || r.parts.length < 2) return [r];
    const out: Run[] = [];
    for (const p of r.parts) {
      const last = out[out.length - 1];
      const end = last ? (last.x ?? 0) + (last.width ?? 0) : -Infinity;
      if (last && p.x - end <= r.size * 0.6) {
        last.text += p.text;
        last.width = p.x + p.width - (last.x ?? p.x);
      } else out.push({ ...r, text: p.text, x: p.x, width: p.width, parts: undefined });
    }
    return out;
  });
}

/** One text box: its lines, each a paragraph starting where it started, on its own baseline. */
function boxXml(lines: Line[], lineHeight: number, id: number): string {
  const x = Math.min(...lines.map((l) => l.x0));
  const right = Math.max(...lines.map((l) => l.x1));
  const first = lines[0] as Line;
  const size = Math.max(...first.runs.map((r) => r.size));
  const top = first.baseline - (lineHeight - size * DESCENT);
  const height = lineHeight * lines.length + 2;
  // A little wider than the words: the box never wraps (wrap="none"), but a box too tight clips.
  const width = (right - x) * 1.12 + 8;
  const paras = lines
    .map((line, i) => {
      // Each line after the first sits at its own distance below the one before.
      const gap = i === 0 ? lineHeight : line.baseline - (lines[i - 1] as Line).baseline;
      // A wide gap on the page (a number set apart, a label, a column of its own) is a tab to a
      // tab stop where the next words started, so they land where they were.
      const stops: number[] = [];
      let end = line.x0;
      const runs = placed(line).map((r, j) => {
        // Where its letters start on the page, and how far that is past the words before it.
        const at = r.x ?? end;
        const startsAfterGap = j > 0 && at - end > r.size * 0.6;
        end = at + (r.width ?? 0);
        if (!startsAfterGap) return runXml(r, r.width);
        stops.push(at - x);
        return `<w:r><w:tab/></w:r>${runXml({ ...r, text: r.text.replace(/^ +/, "") }, r.width)}`;
      });
      const tabs = stops.length
        ? `<w:tabs>${stops.map((t) => `<w:tab w:val="left" w:pos="${tw(t)}"/>`).join("")}</w:tabs>`
        : "";
      return `<w:p><w:pPr>${tabs}<w:spacing w:before="0" w:after="0" w:line="${tw(Math.max(1, gap))}" w:lineRule="exact"/><w:ind w:left="${tw(line.x0 - x)}" w:right="0"/></w:pPr>${runs.join("")}</w:p>`;
    })
    .join("");
  const graphic = `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(width)}" cy="${emu(height)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></wps:spPr><wps:txbx><w:txbxContent>${paras}</w:txbxContent></wps:txbx><wps:bodyPr rot="0" vert="horz" wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t" anchorCtr="0"><a:noAutofit/></wps:bodyPr></wps:wsp></a:graphicData></a:graphic>`;
  const anchor = `<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${251659264 + id}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${emu(x)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${emu(top)}</wp:posOffset></wp:positionV><wp:extent cx="${emu(width)}" cy="${emu(height)}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${id}" name="Text ${id}"/><wp:cNvGraphicFramePr/>${graphic}</wp:anchor>`;
  return `<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing>${anchor}</w:drawing></mc:Choice><mc:Fallback/></mc:AlternateContent></w:r>`;
}

/** Every text box of a page, as runs to go in the paragraph that holds the page's picture. */
export function pageBoxes(layout: PageLayout, firstId: number): { xml: string; count: number } {
  const boxes: string[] = [];
  let id = firstId;
  for (const b of layout.blocks) {
    if (b.kind === "paragraph" && b.lines.length) {
      const size = Math.max(...b.lines.flatMap((l) => l.runs.map((r) => r.size)));
      boxes.push(boxXml(b.lines, b.lineHeight ?? size * 1.2, id++));
    } else if (b.kind === "table") {
      // A table's cells as boxes of their own, where they were.
      b.rows.forEach((cells, r) =>
        cells.forEach((runs, c) => {
          if (!runs.length) return;
          // A table drawn with lines knows each cell's lines of text, on their own baselines.
          const lines = b.ruled?.lines[r]?.[c];
          if (lines?.length) {
            const size = Math.max(...lines.flatMap((l) => l.runs.map((x) => x.size)));
            const gaps = lines.slice(1).map((l, i) => l.baseline - (lines[i] as Line).baseline);
            boxes.push(boxXml(lines, gaps[0] ?? size * 1.2, id++));
            return;
          }
          const size = Math.max(...runs.map((x) => x.size));
          const baseline = (b.rowTops[r] ?? b.top) + size * 0.8;
          // Where its words start (a cell's words may be centred), else the column's edge.
          const starts = runs.flatMap((x) => (x.x === undefined ? [] : [x.x]));
          const x0 = starts.length ? Math.min(...starts) : (b.columns[c] ?? b.left);
          boxes.push(
            boxXml([{ runs, baseline, x0, x1: b.columns[c + 1] ?? b.right }], size * 1.2, id++),
          );
        }),
      );
    }
  }
  return { xml: boxes.join(""), count: id - firstId };
}
