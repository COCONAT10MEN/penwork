import { describe, expect, it } from "vitest";
import { EMPTY_LIBRARY, recordDocument, recordOpen, type Library } from "./libraryFile";
import { allFiles, countByKind, findFiles, overLimit } from "./libraryFiles";

function library(): Library {
  let next = EMPTY_LIBRARY;
  next = recordOpen(
    next,
    {
      path: "C:\\Waves.pwpptx",
      title: "Waves",
      slides: 8,
      quizzes: 0,
      interactive: false,
      ink: false,
      text: "sound and light",
    },
    "2026-11-01T10:00:00Z",
    () => "deck",
  );
  next = recordDocument(next, "C:\\Budget.xlsx", "2026-11-02T10:00:00Z", () => "sheet");
  next = recordDocument(next, "C:\\Notes.docx", "2026-10-30T10:00:00Z", () => "word");
  return recordDocument(next, "C:\\paper 10.pdf", "2026-10-29T10:00:00Z", () => "pdf");
}

describe("allFiles", () => {
  it("puts every type in one list, newest first", () => {
    expect(allFiles(library()).map((f) => f.kind)).toEqual(["sheet", "deck", "word", "pdf"]);
  });
});

describe("findFiles", () => {
  const files = allFiles(library());

  it("filters by type", () => {
    expect(findFiles(files, { filter: "pdf" }).map((f) => f.title)).toEqual(["paper 10.pdf"]);
  });

  it("searches names and a presentation's words", () => {
    expect(findFiles(files, { query: "budget" }).map((f) => f.kind)).toEqual(["sheet"]);
    expect(findFiles(files, { query: "LIGHT sound" }).map((f) => f.kind)).toEqual(["deck"]);
  });

  it("sorts by name, then by type", () => {
    expect(findFiles(files, { sort: "name" }).map((f) => f.title)).toEqual([
      "Budget.xlsx",
      "Notes.docx",
      "paper 10.pdf",
      "Waves",
    ]);
    expect(findFiles(files, { sort: "type" }).map((f) => f.kind)).toEqual([
      "word",
      "pdf",
      "deck",
      "sheet",
    ]);
  });

  it("shows only favorites when asked", () => {
    const starred = files.map((f) => ({ ...f, favorite: f.kind === "word" }));
    expect(findFiles(starred, { favorites: true }).map((f) => f.kind)).toEqual(["word"]);
  });
});

describe("countByKind", () => {
  it("counts each type", () => {
    expect(countByKind(allFiles(library()))).toEqual({
      all: 4,
      deck: 1,
      word: 1,
      sheet: 1,
      pdf: 1,
    });
  });
});

describe("overLimit", () => {
  it("names the oldest files past the limit", () => {
    expect(overLimit(library(), 2)).toEqual(["word", "pdf"]);
  });

  it("never drops a favorite, and zero means keep everything", () => {
    const base = library();
    const starred = {
      ...base,
      documents: base.documents.map((d) => ({ ...d, favorite: d.kind === "pdf" })),
    };
    expect(overLimit(starred, 2)).toEqual(["word"]);
    expect(overLimit(base, 0)).toEqual([]);
  });
});
