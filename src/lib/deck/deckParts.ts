/** What a new deck is made of before it becomes a .pwpptx (docs/DECK-FORMAT.md §2). */

export interface DeckBrand {
  badgeWord?: string;
  badgeNumber?: string;
  deckName?: string;
  kicker?: string;
}

export interface DeckParts {
  title: string;
  lang: string;
  dir: "ltr" | "rtl";
  brand: DeckBrand;
  slidesHtml: string;
  themeCss: string;
  widgetsJs: string;
}

/** The template's own colours, for a new deck. */
export const DEFAULT_THEME = `:root{
  --ink:#0b2a36;
  --navy:#12303d;
  --teal:#0aa0c8;
  --teal2:#0e6f8e;
  --or:#c0562f;
  --cy:#6fd8ee;
  --paper:#f4f9fb;
}
.hero:not(:has(.bg)){background:radial-gradient(1300px 760px at 78% 30%,#0f4a63 0,#07161e 62%,#04090c 100%)}
`;

export function manifestFor(deck: DeckParts, generator: string, now: string): object {
  return {
    format: "penwork-deck",
    version: 1,
    engine: "lop-1",
    title: deck.title,
    lang: deck.lang,
    dir: deck.dir,
    stage: { w: 1920, h: 1080 },
    brand: deck.brand,
    created: now,
    modified: now,
    generator,
  };
}
