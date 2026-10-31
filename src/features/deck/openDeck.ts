import { invoke } from "@tauri-apps/api/core";
import { extractImages } from "../../lib/deck/assets";
import { deckAccent, deckFacts, type DeckFacts } from "../../lib/deck/facts";
import { manifestFor, type DeckParts } from "../../lib/deck/importPaste";
import { fileTitle, readManifest, type DeckManifest } from "../../lib/deck/manifest";
import { sanitizeSlides } from "../../lib/deck/sanitize";

export interface OpenDeck {
  /** Names this deck on the private slide address. */
  token: string;
  path: string;
  manifest: DeckManifest;
  slideCount: number;
  /** What the sanitiser took out, for the "Cleaned up while opening" note. */
  removed: string[];
  facts: DeckFacts;
  /** The deck's main colour, for "Match the open deck". */
  accent: string | null;
  /** Changes when the file does, so a cached thumbnail knows it's out of date. */
  stamp: string;
  hasInk: boolean;
}

interface OpenedFromRust {
  token: string;
  path: string;
  stamp: string;
  content: {
    manifest: unknown;
    slidesHtml: string;
    themeCss: string | null;
    ink: unknown;
  };
}

export interface DeckError {
  code: string;
  message: string;
}

export function isDeckError(value: unknown): value is DeckError {
  return typeof value === "object" && value !== null && "code" in value && "message" in value;
}

/** Every deck comes through here, however it arrived, so all of them are cleaned the same way. */
async function publishSlides(token: string, rawHtml: string) {
  const clean = sanitizeSlides(rawHtml);
  const { html, assets } = await extractImages(clean.html);
  for (const asset of assets) {
    await invoke("add_deck_asset", asset.bytes, {
      headers: { "deck-token": token, "asset-name": asset.name },
    });
  }
  // Rust only serves slides after this, so nothing unsanitised ever reaches the slide page.
  await invoke("set_deck_slides", { token, html });
  return { html, removed: clean.removed, slideCount: clean.slideCount };
}

export async function openDeckFile(path: string): Promise<OpenDeck> {
  const opened = await invoke<OpenedFromRust>("open_deck", { path });
  const slides = await publishSlides(opened.token, opened.content.slidesHtml);
  return {
    token: opened.token,
    path: opened.path,
    manifest: readManifest(opened.content.manifest, fileTitle(path)),
    slideCount: slides.slideCount,
    removed: slides.removed,
    facts: deckFacts(slides.html),
    accent: deckAccent(opened.content.themeCss ?? ""),
    stamp: opened.stamp,
    hasInk: opened.content.ink !== null,
  };
}

async function openParts(deck: DeckParts, generator: string) {
  const manifest = manifestFor(deck, generator, new Date().toISOString());
  const token = await invoke<string>("create_deck_session", {
    manifest,
    themeCss: deck.themeCss,
    widgetsJs: deck.widgetsJs,
  });
  const slides = await publishSlides(token, deck.slidesHtml);
  return {
    token,
    manifest: readManifest(manifest, deck.title),
    slideCount: slides.slideCount,
    removed: slides.removed,
    facts: deckFacts(slides.html),
    accent: deckAccent(deck.themeCss),
    hasInk: false,
  };
}

/** A new deck with no file yet: it lives in the app's folder until Save as arrives in M4. */
export async function createDraft(deck: DeckParts, generator: string): Promise<OpenDeck> {
  const opened = await openParts(deck, generator);
  const path = await invoke<string>("write_draft", { token: opened.token });
  return { ...opened, path, stamp: "" };
}

export function closeDeckFile(token: string): void {
  void invoke("close_deck", { token });
}

/** On Windows, WebView2 sees a custom scheme as http://<scheme>.localhost. */
export function deckUrl(token: string): string {
  return `http://penwork-deck.localhost/${token}/index.html`;
}

/** .pwpptx only. Raw .html is refused on purpose: the format exists so decks stay contained. */
export function isDeckPath(path: string): boolean {
  return path.toLowerCase().endsWith(".pwpptx");
}
