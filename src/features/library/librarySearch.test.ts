import { describe, expect, it } from "vitest";
import { parseLibrary, type LibraryDeck } from "./libraryFile";
import { findDecks, matchSnippet } from "./librarySearch";

function deck(change: Partial<LibraryDeck>): LibraryDeck {
  const base = parseLibrary(JSON.stringify({ decks: [{ id: "a", path: "C:\\a.pwpptx" }] }));
  return { ...(base.decks[0] as LibraryDeck), ...change };
}

const decks = [
  deck({ id: "1", title: "Newton's Second Law", text: "Force equals mass times acceleration" }),
  deck({ id: "2", title: "Waves", text: "Frequency and wavelength", favorite: true, quizzes: 2 }),
  deck({ id: "3", title: "Optics", text: "Lenses and mirrors", interactive: true }),
];
const ids = (found: LibraryDeck[]) => found.map((d) => d.id);

describe("findDecks", () => {
  it("finds by title and by slide words, ignoring case", () => {
    expect(ids(findDecks(decks, "waves", "all"))).toEqual(["2"]);
    expect(ids(findDecks(decks, "LENSES", "all"))).toEqual(["3"]);
  });

  it("needs every word, wherever each one is", () => {
    expect(ids(findDecks(decks, "newton mass", "all"))).toEqual(["1"]);
    expect(findDecks(decks, "newton lenses", "all")).toEqual([]);
  });

  it("shows everything for an empty search", () => {
    expect(findDecks(decks, "   ", "all")).toHaveLength(3);
  });

  it("filters", () => {
    expect(ids(findDecks(decks, "", "favorites"))).toEqual(["2"]);
    expect(ids(findDecks(decks, "", "quizzes"))).toEqual(["2"]);
    expect(ids(findDecks(decks, "", "interactive"))).toEqual(["3"]);
  });

  it("combines search with a filter", () => {
    expect(findDecks(decks, "lenses", "favorites")).toEqual([]);
  });
});

describe("matchSnippet", () => {
  it("shows the words around a match in the slides", () => {
    expect(matchSnippet(decks[0] as LibraryDeck, "mass")).toContain("mass times");
  });

  it("stays quiet when the title already explains the match", () => {
    expect(matchSnippet(decks[1] as LibraryDeck, "waves")).toBeNull();
  });
});
