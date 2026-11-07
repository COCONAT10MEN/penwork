import { describe, expect, it } from "vitest";
import { layoutPage, type Piece } from "./pageLayout";

const PAGE = { width: 612, height: 792 };
const piece = (
  text: string,
  x: number,
  y: number,
  width: number,
  o: Partial<Piece> = {},
): Piece => ({
  text,
  x,
  y,
  width,
  size: 11,
  font: "Calibri",
  bold: false,
  italic: false,
  color: "#000000",
  ...o,
});

describe("reading a page's layout back", () => {
  it("finds a centred title, a right-aligned date, a heading and a wrapped paragraph", () => {
    const out = layoutPage(
      [
        piece("Annual Report", 236, 80, 140, { size: 24, bold: true, color: "#1f4c99" }),
        piece("March 2026", 480, 104, 60, { italic: true }),
        // Body lines that reach the right margin, then a short last line.
        piece("The company grew in every region this year and costs stayed", 72, 140, 468),
        piece("flat while the new warehouse opened two months early, so the", 72, 154, 468),
        piece("year ended well.", 72, 168, 90),
      ],
      [],
      PAGE,
    );
    const [title, date, para] = out.blocks;
    expect(title).toMatchObject({ kind: "paragraph", align: "center", heading: 1 });
    expect(date).toMatchObject({ kind: "paragraph", align: "right" });
    expect(para).toMatchObject({ kind: "paragraph", align: "justify", lineHeight: 14 });
    expect(para?.kind === "paragraph" && para.runs.map((r) => r.text).join("")).toBe(
      "The company grew in every region this year and costs stayed flat while the new warehouse opened two months early, so the year ended well.",
    );
  });

  it("keeps runs of different styles, with the spaces between them", () => {
    const out = layoutPage(
      [piece("Bold", 72, 100, 24, { bold: true }), piece("then plain", 99, 100, 50)],
      [],
      PAGE,
    );
    const p = out.blocks[0];
    expect(p?.kind === "paragraph" && p.runs.map((r) => [r.text, r.bold])).toEqual([
      ["Bold", true],
      [" then plain", false],
    ]);
  });

  it("makes words lined up in columns row after row into a table", () => {
    const rows = [
      ["Region", "Revenue", "Growth"],
      ["North", "1,250,000", "14%"],
      ["South", "980,500", "9%"],
    ];
    const pieces = rows.flatMap((r, i) =>
      r.map((cell, j) => piece(cell, [78, 248, 378][j] ?? 0, 300 + i * 20, 50)),
    );
    const out = layoutPage(pieces, [], PAGE);
    expect(out.blocks).toHaveLength(1);
    const t = out.blocks[0];
    expect(t?.kind).toBe("table");
    expect(
      t?.kind === "table" && t.rows.map((r) => r.map((c) => c.map((x) => x.text).join(""))),
    ).toEqual(rows);
  });

  it("reads text in two columns left column first, not across", () => {
    const left = ["The north region benefited most", "from the new warehouse this year.", "Short."];
    const right = [
      "The south saw slower growth after",
      "a wet spring delayed the projects.",
      "Too.",
    ];
    const pieces = left.flatMap((l, i) => [
      piece(l, 72, 200 + i * 14, i === 2 ? 30 : 222),
      piece(right[i] ?? "", 318, 200 + i * 14, i === 2 ? 30 : 222),
    ]);
    const out = layoutPage(pieces, [], PAGE);
    const texts = out.blocks.map((b) =>
      b.kind === "paragraph" ? b.runs.map((r) => r.text).join("") : b.kind,
    );
    expect(texts).toEqual([
      "The north region benefited most from the new warehouse this year. Short.",
      "The south saw slower growth after a wet spring delayed the projects. Too.",
    ]);
    expect(out.blocks.map((b) => b.kind === "paragraph" && b.column?.index)).toEqual([0, 1]);
  });

  it("puts pictures in where they sit on the page", () => {
    const out = layoutPage(
      [piece("Above", 72, 100, 40), piece("Below", 72, 400, 40)],
      [{ id: 0, x: 72, y: 150, width: 200, height: 120 }],
      PAGE,
    );
    expect(out.blocks.map((b) => b.kind)).toEqual(["paragraph", "picture", "paragraph"]);
  });

  it("joins a raised small number to its line as a superscript", () => {
    const out = layoutPage(
      [piece("Unit: Wb/m", 72, 100, 60), piece("2", 132, 96, 4, { size: 7 })],
      [],
      PAGE,
    );
    expect(out.blocks).toHaveLength(1);
    const p = out.blocks[0];
    const runs = p?.kind === "paragraph" ? p.runs : [];
    expect(runs.map((r) => [r.text.trim(), Math.round(r.rise)])).toEqual([
      ["Unit: Wb/m", 0],
      ["2", 4],
    ]);
  });

  it("keeps a stacked fraction's two halves apart: only one joins the line", () => {
    const out = layoutPage(
      [
        piece("B =", 72, 100, 20),
        piece("μI", 98, 96, 10, { size: 7 }),
        piece("2πd", 97, 104, 12, { size: 7 }),
      ],
      [],
      PAGE,
    );
    const lines = out.blocks.flatMap((b) => (b.kind === "paragraph" ? b.lines : []));
    expect(lines).toHaveLength(2);
    expect(lines[0]?.runs.map((r) => r.text.trim())).toEqual(["B =", "μI"]);
    expect(lines[1]?.runs.map((r) => r.text.trim())).toEqual(["2πd"]);
  });
});
