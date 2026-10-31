/** What the library remembers about a deck's content, for its cards and for search. */

export interface DeckFacts {
  quizzes: number;
  interactive: boolean;
  /** Slide words, so search can find a deck without opening it. */
  text: string;
}

// Enough for a teacher's deck. A cap keeps library.json small, whatever is opened.
const MAX_TEXT = 20_000;

export function deckFacts(cleanHtml: string): DeckFacts {
  const template = document.createElement("template");
  template.innerHTML = cleanHtml;
  const root = template.content;
  // Quiz data is JSON inside a <script>, and its words are useful, so it stays in the text.
  const text = (root.textContent ?? "").replace(/\s+/g, " ").trim();
  return {
    quizzes: root.querySelectorAll(".quiz").length,
    interactive: root.querySelector("[data-w]") !== null,
    text: text.slice(0, MAX_TEXT),
  };
}

const ACCENT = /--teal\s*:\s*(#[0-9a-f]{6})\b/i;

/** The deck's main colour, for "Match the open deck". */
export function deckAccent(themeCss: string): string | null {
  return themeCss.match(ACCENT)?.[1] ?? null;
}
