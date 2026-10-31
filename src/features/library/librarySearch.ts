import type { LibraryDeck } from "./libraryFile";

export type DeckFilter = "all" | "favorites" | "quizzes" | "interactive";

const words = (query: string) => query.toLocaleLowerCase().split(/\s+/).filter(Boolean);

function matchesFilter(deck: LibraryDeck, filter: DeckFilter): boolean {
  if (filter === "favorites") return deck.favorite;
  if (filter === "quizzes") return deck.quizzes > 0;
  if (filter === "interactive") return deck.interactive;
  return true;
}

/** Every word must appear somewhere in the deck's title or slides. */
export function findDecks(decks: LibraryDeck[], query: string, filter: DeckFilter): LibraryDeck[] {
  const wanted = words(query);
  return decks.filter((deck) => {
    if (!matchesFilter(deck, filter)) return false;
    const haystack = `${deck.title} ${deck.text}`.toLocaleLowerCase();
    return wanted.every((word) => haystack.includes(word));
  });
}

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
