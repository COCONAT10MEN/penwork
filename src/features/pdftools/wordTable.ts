import type { Run, TableBlock } from "../../lib/pdftools/pageLayout";

/**
 * A table for PDF to Word. One drawn with lines keeps its grid: the same column widths and row
 * heights, its borders' colour and weight, shaded cells, the space inside cells, and each cell's
 * words left, centred or right, top or bottom, as they were. One read from how words line up had
 * no lines, so it has none: its words start where they did, each row as far below the last.
 */

type Docx = typeof import("docx");
const tw = (pt: number) => Math.max(0, Math.round(pt * 20));

export function wordTable(
  docx: Docx,
  b: TableBlock,
  left: number,
  runs: (list: Run[]) => InstanceType<Docx["TextRun"]>[],
) {
  const ruled = b.ruled;
  const edges = [...b.columns, ruled ? b.right : b.right + 6];
  const widths = b.columns.map((c, i) =>
    tw(Math.max(ruled ? 4 : 24, (edges[i + 1] ?? c + 60) - c)),
  );
  const line = ruled
    ? {
        style: docx.BorderStyle.SINGLE,
        // Word measures borders in eighths of a point, from a quarter point up.
        size: Math.max(2, Math.min(96, Math.round(ruled.thickness * 8))),
        color: ruled.color.slice(1),
      }
    : { style: docx.BorderStyle.NONE, size: 0, color: "auto" };
  const pad = ruled ? tw(ruled.padding) : 0;
  const ALIGN = {
    left: docx.AlignmentType.LEFT,
    center: docx.AlignmentType.CENTER,
    right: docx.AlignmentType.RIGHT,
  } as const;
  const VALIGN = {
    top: docx.VerticalAlign.TOP,
    center: docx.VerticalAlign.CENTER,
    bottom: docx.VerticalAlign.BOTTOM,
  } as const;
  return new docx.Table({
    columnWidths: widths,
    width: { size: widths.reduce((a, w) => a + w, 0), type: docx.WidthType.DXA },
    indent: {
      size: tw((ruled ? b.left : (b.columns[0] ?? b.left)) - left),
      type: docx.WidthType.DXA,
    },
    layout: docx.TableLayoutType.FIXED,
    borders: {
      top: line,
      bottom: line,
      left: line,
      right: line,
      insideHorizontal: line,
      insideVertical: line,
    },
    rows: b.rows.map(
      (row, i) =>
        new docx.TableRow({
          tableHeader: i === 0,
          height: {
            // A drawn row is as tall as its lines; a row read from its words reaches down to
            // where the next one starts.
            value: tw(
              (ruled || i === b.rows.length - 1
                ? (b.rowBottoms[i] ?? 0)
                : (b.rowTops[i + 1] ?? 0)) - (b.rowTops[i] ?? 0),
            ),
            rule: docx.HeightRule.ATLEAST,
          },
          children: row.map((cell, j) => {
            const shade = ruled?.shade[i]?.[j];
            const lines = ruled?.lines[i]?.[j] ?? [];
            const cellWidth = (edges[j + 1] ?? 0) - (edges[j] ?? 0);
            // Lines that end well short of the cell's edge were ended on purpose (an address in a
            // cell); the others wrapped, and Word wraps them again.
            const paragraphs: Run[][] = [];
            if (ruled && lines.length > 1) {
              let cur: Run[] = [];
              lines.forEach((l, k) => {
                const runsHere =
                  k > 0 && cur.length
                    ? l.runs.map((r, m) => (m === 0 ? { ...r, text: ` ${r.text.trimStart()}` } : r))
                    : l.runs;
                cur.push(...runsHere);
                const short = (edges[j + 1] ?? 0) - l.x1 > cellWidth * 0.3;
                if (short || k === lines.length - 1) {
                  paragraphs.push(cur);
                  cur = [];
                }
              });
            } else paragraphs.push(cell);
            return new docx.TableCell({
              width: { size: widths[j] ?? 1000, type: docx.WidthType.DXA },
              margins: { top: 0, bottom: 0, left: pad, right: pad },
              ...(shade
                ? { shading: { fill: shade.slice(1), type: docx.ShadingType.CLEAR, color: "auto" } }
                : {}),
              ...(ruled ? { verticalAlign: VALIGN[ruled.valign[i]?.[j] ?? "top"] } : {}),
              children: paragraphs.map(
                (p) =>
                  new docx.Paragraph({
                    ...(ruled ? { alignment: ALIGN[ruled.align[i]?.[j] ?? "left"] } : {}),
                    spacing: { before: 0, after: 0 },
                    children: runs(p),
                  }),
              ),
            });
          }),
        }),
    ),
  });
}
