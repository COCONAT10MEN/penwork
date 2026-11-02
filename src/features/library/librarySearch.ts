import type { LibraryDeck } from "./libraryFile";

const words = (query: string) => query.toLocaleLowerCase().split(/\s+/).filter(Boolean);

/** A few words around the match in the slides, to show why a deck was found. */
export function matchSnippet(deck: LibraryDeck, query: string): string | null {
  const title = deck.title.toLocaleLowerCase();
  const word = words(query).find((w) => !title.includes(w));
  if (!word) return null;
  const at = deck.text.toLocaleLowerCase().indexOf(word);
  if (at < 0) return null;
  const start = Math.max(0, at - 24);
  const piece = deck.text.slice(start, at + word.length + 32).trim();
  return `${start > 0 ? "…" : ""}${piece}…`;
}
