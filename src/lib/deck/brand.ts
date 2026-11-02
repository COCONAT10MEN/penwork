import type { DeckSlide } from "./slideOps";

/** The header values every slide repeats, kept in the manifest and copied into each slide. */
export interface Brand {
  word: string;
  number: string;
  name: string;
  kicker: string;
}

/** Reads the first slide that has each value: older files may not say so in the manifest. */
export function readBrand(
  raw: Record<string, unknown>,
  title: string,
  slides: readonly DeckSlide[],
): Brand {
  const brand = (typeof raw.brand === "object" && raw.brand !== null ? raw.brand : {}) as Record<
    string,
    unknown
  >;
  const page = document.createElement("template");
  page.innerHTML = slides.map((s) => s.html).join("");
  const found = (selector: string) => page.content.querySelector(selector)?.textContent ?? "";
  const text = (value: unknown, selector: string, fallback: string) =>
    typeof value === "string" && value ? value : found(selector) || fallback;
  return {
    word: text(brand.badgeWord, ".sv", "SESSION"),
    number: text(brand.badgeNumber, ".sn", "1"),
    name: text(brand.deckName, ".snm", title),
    kicker: text(brand.kicker, ".kick", ""),
  };
}

/** Puts the values into one slide. Words in the file stay exactly as they are otherwise. */
export function applyBrand(slide: string, brand: Brand): string {
  const page = document.createElement("template");
  page.innerHTML = slide;
  const set = (selector: string, value: string) => {
    for (const element of Array.from(page.content.querySelectorAll(selector))) {
      element.textContent = value;
    }
  };
  set(".sv", brand.word);
  set(".sn", brand.number);
  set(".snm", brand.name);
  if (brand.kicker) set(".kick", brand.kicker);
  return page.innerHTML;
}
