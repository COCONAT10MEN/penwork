import { invoke } from "@tauri-apps/api/core";
import { extractImages } from "../../lib/deck/assets";
import { deckAccent, deckFacts, type DeckFacts } from "../../lib/deck/facts";
import { importHtml, manifestFor, type ImportedDeck } from "../../lib/deck/importHtml";
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
  /** Set for a deck imported from .html: what's worth saying about the import. */
  importNotes?: string[];
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

async function openImported(deck: ImportedDeck, generator: string) {
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

/** An .html deck is read fresh each time. The original file is never written to. */
export async function importHtmlFile(path: string): Promise<OpenDeck> {
  const { text, stamp } = await invoke<{ text: string; stamp: string }>("read_html_deck", { path });
  const deck = importHtml(text, path);
  if (!deck) throw { code: "not-a-deck", message: "This .html file has no slides in it." };
  const opened = await openImported(deck, "Imported from .html");
  return { ...opened, path, stamp, importNotes: deck.notes };
}

/** A new deck with no file yet: it lives in the app's folder until Save as arrives in M4. */
export async function createDraft(deck: ImportedDeck, generator: string): Promise<OpenDeck> {
  const opened = await openImported(deck, generator);
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

export type OpenableKind = "pwpptx" | "html" | "other";

export function fileKind(path: string): OpenableKind {
  const lower = path.toLowerCase();
  if (lower.endsWith(".pwpptx")) return "pwpptx";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  return "other";
}
