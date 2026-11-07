import { describe, expect, it } from "vitest";
import { matchFace, parseFontName, type Installed } from "./fontMatch";

const WINDOWS: Installed[] = [
  { name: "Arial (TrueType)", file: "C:\\Windows\\Fonts\\arial.ttf" },
  { name: "Arial Bold (TrueType)", file: "C:\\Windows\\Fonts\\arialbd.ttf" },
  { name: "Calibri (TrueType)", file: "C:\\Windows\\Fonts\\calibri.ttf" },
  { name: "Calibri Bold Italic (TrueType)", file: "C:\\Windows\\Fonts\\calibriz.ttf" },
  { name: "Calibri Light (TrueType)", file: "C:\\Windows\\Fonts\\calibril.ttf" },
  { name: "Times New Roman Italic (TrueType)", file: "C:\\Windows\\Fonts\\timesi.ttf" },
  { name: "Courier New (TrueType)", file: "C:\\Windows\\Fonts\\cour.ttf" },
  { name: "Cambria & Cambria Math (TrueType)", file: "C:\\Windows\\Fonts\\cambria.ttc" },
];

describe("finding a PDF's font among the installed ones", () => {
  it("reads family and style out of a PDF font name", () => {
    expect(parseFontName("BCDEEE+TimesNewRomanPS-BoldItalicMT")).toEqual({
      family: "TimesNewRoman",
      extra: "",
      bold: true,
      italic: true,
    });
    expect(parseFontName("ArialMT")).toMatchObject({ family: "Arial", bold: false });
    expect(parseFontName("Calibri,Bold")).toMatchObject({ family: "Calibri", bold: true });
    expect(parseFontName("Calibri-Light")).toMatchObject({ family: "Calibri", extra: "Light" });
  });

  it("finds the installed font, in the wanted style", () => {
    const bold = matchFace(WINDOWS, "ABCDEF+Arial-BoldMT", "sans", { bold: true, italic: false });
    expect(bold).toMatchObject({ installed: "Arial Bold (TrueType)", bold: true });
    expect(bold.css).toMatch(/^'Arial'/);
    const both = matchFace(WINDOWS, "Calibri", "sans", { bold: true, italic: true });
    expect(both.installed).toBe("Calibri Bold Italic (TrueType)");
    expect(
      matchFace(WINDOWS, "Calibri-Light", "sans", { bold: false, italic: false }).installed,
    ).toBe("Calibri Light (TrueType)");
  });

  it("takes the PDF built-ins as the Windows fonts drawn the same", () => {
    expect(matchFace(WINDOWS, "Helvetica", "sans", { bold: false, italic: false }).installed).toBe(
      "Arial (TrueType)",
    );
    expect(
      matchFace(WINDOWS, "Times-Italic", "serif", { bold: false, italic: true }).installed,
    ).toBe("Times New Roman Italic (TrueType)");
  });

  it("uses Courier New for monospace, whatever the words were in", () => {
    const mono = matchFace(WINDOWS, "Calibri", "sans", { bold: false, italic: false, mono: true });
    expect(mono).toMatchObject({ installed: "Courier New (TrueType)", generic: "mono" });
  });

  it("shows a font collection but doesn't put it in the file, and falls back when missing", () => {
    const cambria = matchFace(WINDOWS, "Cambria", "serif", { bold: false, italic: false });
    expect(cambria.css).toMatch(/^'Cambria'/);
    expect(cambria.installed).toBeUndefined();
    const none = matchFace(WINDOWS, "SomeFont-Bold", "serif", { bold: true, italic: false });
    expect(none.installed).toBeUndefined();
    expect(none.css).toMatch(/Times New Roman/);
  });

  it("takes the free same-size fonts, and KaTeX's, as Windows' own", () => {
    const pick = (n: string, g: "sans" | "serif", italic = false) =>
      matchFace(WINDOWS, n, g, { bold: false, italic }).css;
    expect(pick("ABCDEF+Arimo", "sans")).toMatch(/^'Arial'/);
    expect(pick("LiberationSans", "sans")).toMatch(/^'Arial'/);
    expect(pick("KaTeX_Math-Italic", "serif", true)).toMatch(/^'Times New Roman'/);
    expect(pick("KaTeX_AMS-Regular", "serif")).toMatch(/^'Cambria Math'/);
  });
});
