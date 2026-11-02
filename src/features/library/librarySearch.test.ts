import { describe, expect, it } from "vitest";
import { parseLibrary, type LibraryDeck } from "./libraryFile";
import { matchSnippet } from "./librarySearch";

function deck(change: Partial<LibraryDeck>): LibraryDeck {
  const base = parseLibrary(JSON.stringify({ decks: [{ id: "a", path: "C:\\a.pwpptx" }] }));
  return { ...(base.decks[0] as LibraryDeck), ...change };
}

const decks = [
  deck({ id: "1", title: "Newton's Second Law", text: "Force equals mass times acceleration" }),
  deck({ id: "2", title: "Waves", text: "Frequency and wavelength", favorite: true, quizzes: 2 }),
  deck({ id: "3", title: "Optics", text: "Lenses and mirrors", interactive: true }),
];

describe("matchSnippet", () => {
  it("shows the words around a match in the slides", () => {
    expect(matchSnippet(decks[0] as LibraryDeck, "mass")).toContain("mass times");
  });

  it("stays quiet when the title already explains the match", () => {
    expect(matchSnippet(decks[1] as LibraryDeck, "waves")).toBeNull();
  });
});
