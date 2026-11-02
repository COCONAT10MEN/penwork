import { describe, expect, it } from "vitest";
import {
  EMPTY_LIBRARY,
  markExisting,
  markMissing,
  parseLibrary,
  recordDocument,
  removeDocument,
} from "./libraryFile";

const NOW = "2026-11-02T10:00:00Z";
const add = (path: string, library = EMPTY_LIBRARY, replaces: string | null = null) =>
  recordDocument(library, path, NOW, () => `id-${path}`, replaces);

describe("documents in the library", () => {
  it("reads a library from before documents existed", () => {
    const library = parseLibrary(JSON.stringify({ version: 1, decks: [] }));
    expect(library.documents).toEqual([]);
  });

  it("drops rows that aren't documents", () => {
    const text = JSON.stringify({
      decks: [],
      documents: [
        { id: "a", path: "C:\\a.pdf" },
        { id: "b", path: "C:\\b.html" },
        { path: "C:\\c.pdf" },
      ],
    });
    expect(parseLibrary(text).documents.map((d) => d.id)).toEqual(["a"]);
  });

  it("works out the name and kind from the path", () => {
    const [document] = add("C:\\Work\\Marks.XLSX").documents;
    expect(document).toMatchObject({ name: "Marks.XLSX", kind: "sheet", missing: false });
  });

  it("lists the same file once, newest first, ignoring case", () => {
    const library = add("c:\\work\\a.pdf", add("C:\\Work\\b.pdf", add("C:\\Work\\A.pdf")));
    expect(library.documents.map((d) => d.path)).toEqual(["c:\\work\\a.pdf", "C:\\Work\\b.pdf"]);
  });

  it("keeps the row when a file is saved somewhere new", () => {
    const first = add("C:\\Work\\a.docx");
    const moved = add("C:\\Other\\a.docx", first, "C:\\Work\\a.docx");
    expect(moved.documents).toHaveLength(1);
    expect(moved.documents[0]).toMatchObject({
      id: first.documents[0]?.id,
      path: "C:\\Other\\a.docx",
    });
  });

  it("removes one row and leaves the rest", () => {
    const library = add("C:\\b.pdf", add("C:\\a.pdf"));
    const left = removeDocument(library, "id-C:\\a.pdf");
    expect(left.documents.map((d) => d.name)).toEqual(["b.pdf"]);
  });

  it("marks a missing file", () => {
    expect(markMissing(add("C:\\a.pdf"), "c:\\A.PDF").documents[0]?.missing).toBe(true);
  });

  it("reads existence for decks first, then documents", () => {
    const library = { ...add("C:\\a.pdf"), decks: [] };
    expect(markExisting(library, [false]).documents[0]?.missing).toBe(true);
    expect(markExisting(library, [true]).documents[0]?.missing).toBe(false);
  });
});
