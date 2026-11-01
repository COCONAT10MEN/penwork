import { describe, expect, it } from "vitest";
import {
  EMPTY_LIBRARY,
  markMissing,
  parseLibrary,
  recordOpen,
  removeDeck,
  renameDeck,
  setLastSlide,
} from "./libraryFile";

const open = (
  library = EMPTY_LIBRARY,
  path = "C:\\Decks\\Waves.pwpptx",
  now = "2026-10-30T10:00:00Z",
) =>
  recordOpen(
    library,
    {
      path,
      title: "Waves",
      slides: 8,
      quizzes: 0,
      interactive: false,
      ink: false,
      text: "",
    },
    now,
    () => "new-id",
  );

describe("parseLibrary", () => {
  it("starts empty with no file or a damaged one", () => {
    expect(parseLibrary(null)).toEqual(EMPTY_LIBRARY);
    expect(parseLibrary("{not json")).toEqual(EMPTY_LIBRARY);
    expect(parseLibrary('{"decks":"nope"}')).toEqual(EMPTY_LIBRARY);
  });

  it("drops bad rows and keeps good ones", () => {
    const lib = parseLibrary(
      JSON.stringify({ decks: [{ id: "a", path: "x.pwpptx" }, { id: 1 }, null, { id: "b" }] }),
    );
    expect(lib.decks.map((d) => d.id)).toEqual(["a"]);
    expect(lib.decks[0]).toMatchObject({ slides: 0, favorite: false });
  });

  it("round-trips", () => {
    const lib = open();
    expect(parseLibrary(JSON.stringify(lib))).toEqual(lib);
  });
});

describe("recordOpen", () => {
  it("adds a new deck to the front", () => {
    const lib = open(open(), "C:\\Decks\\Other.pwpptx");
    expect(lib.decks.map((d) => d.path)).toEqual([
      "C:\\Decks\\Other.pwpptx",
      "C:\\Decks\\Waves.pwpptx",
    ]);
  });

  it("reopening keeps its place in the library, with no duplicate", () => {
    let lib = open();
    lib = setLastSlide(lib, "C:\\Decks\\Waves.pwpptx", 5);
    lib = { ...lib, decks: lib.decks.map((d) => ({ ...d, favorite: true, missing: true })) };
    lib = open(lib, "c:\\decks\\WAVES.pwpptx", "2026-10-31T10:00:00Z");
    expect(lib.decks).toHaveLength(1);
    expect(lib.decks[0]).toMatchObject({
      id: "new-id",
      lastSlide: 5,
      favorite: true,
      missing: false,
      lastOpened: "2026-10-31T10:00:00Z",
    });
  });
});

describe("removeDeck and markMissing", () => {
  it("removes only that entry", () => {
    const lib = open();
    expect(removeDeck(lib, "new-id").decks).toEqual([]);
    expect(removeDeck(lib, "other").decks).toHaveLength(1);
  });

  it("marks a deck that couldn't be found", () => {
    expect(markMissing(open(), "c:\\decks\\waves.pwpptx").decks[0]?.missing).toBe(true);
  });
});

describe("renameDeck", () => {
  it("keeps one row when a draft is saved over a file already listed", () => {
    const lib = open(open(), "C:\\Drafts\\New.pwpptx");
    const renamed = renameDeck(lib, "C:\\Drafts\\New.pwpptx", "c:\\decks\\waves.pwpptx");
    expect(renamed.decks.map((d) => d.path)).toEqual(["c:\\decks\\waves.pwpptx"]);
  });
});
