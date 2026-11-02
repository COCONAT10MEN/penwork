import { invoke } from "@tauri-apps/api/core";
import { extractImages } from "../../lib/deck/assets";
import { deckAccent, deckFacts, type DeckFacts } from "../../lib/deck/facts";
import { manifestFor, type DeckParts } from "../../lib/deck/deckParts";
import { fileTitle, readManifest, type DeckManifest } from "../../lib/deck/manifest";
import { sanitizeSlides } from "../../lib/deck/sanitize";
import { splitSlides, withNotes, type DeckSlide } from "../../lib/deck/slideOps";

export interface OpenDeck {
  /** Names this deck on the private slide address. */
  token: string;
  path: string;
  manifest: DeckManifest;
  slideCount: number;
  /** The original, cleaned HTML of each slide: what the editor works on. */
  slides: DeckSlide[];
  /** Kept in the app's own folder, so its first Save asks where to put it. */
  draft: boolean;
  /** Unsaved work brought back from a recovery copy. */
  recovered?: boolean;
  /** What the sanitiser took out, for the "Cleaned up while opening" note. */
  removed: string[];
  facts: DeckFacts;
  /** The deck's main colour, for "Match the open deck". */
  accent: string | null;
  /** Changes when the file does, so a cached thumbnail knows it's out of date. */
  stamp: string;
  hasInk: boolean;
  /** ink.json from the file, unchecked. */
  ink: unknown;
  themeCss: string;
}

interface OpenedFromRust {
  token: string;
  path: string;
  stamp: string;
  draft: boolean;
  content: {
    manifest: unknown;
    slidesHtml: string;
    themeCss: string | null;
    notes: unknown;
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

/** Ink kept off the file lives in the app's own folder, named after where the file is. */
export function inkCopyName(path: string): string {
  let hash = 2166136261;
  for (const c of path.toLowerCase()) hash = Math.imul(hash ^ (c.codePointAt(0) ?? 0), 16777619);
  return `${(hash >>> 0).toString(16)}-${path.length}`;
}

async function inkFor(opened: OpenedFromRust): Promise<unknown> {
  const { manifest, ink } = opened.content;
  const settings = (manifest as { settings?: { keepInk?: unknown } } | null)?.settings;
  if (settings?.keepInk !== false || ink !== null) return ink;
  const text = await invoke<string | null>("read_ink_copy", { name: inkCopyName(opened.path) });
  return text ? (JSON.parse(text) as unknown) : null;
}

async function fromRust(opened: OpenedFromRust, path: string): Promise<OpenDeck> {
  const slides = await publishSlides(opened.token, opened.content.slidesHtml);
  const ink = await inkFor(opened).catch(() => null);
  return {
    token: opened.token,
    path: opened.path,
    manifest: readManifest(opened.content.manifest, fileTitle(path)),
    slideCount: slides.slideCount,
    slides: withNotes(splitSlides(slides.html), opened.content.notes),
    draft: opened.draft,
    removed: slides.removed,
    facts: deckFacts(slides.html),
    accent: deckAccent(opened.content.themeCss ?? ""),
    stamp: opened.stamp,
    hasInk: ink !== null,
    ink,
    themeCss: opened.content.themeCss ?? "",
  };
}

export async function openDeckFile(path: string): Promise<OpenDeck> {
  return fromRust(await invoke<OpenedFromRust>("open_deck", { path }), path);
}

export async function openRecoveryFile(id: string, path: string): Promise<OpenDeck> {
  const opened = await invoke<OpenedFromRust>("open_recovery", { id, path });
  return { ...(await fromRust(opened, path)), recovered: true };
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
    slides: splitSlides(slides.html),
    draft: true,
    themeCss: deck.themeCss ?? "",
    removed: slides.removed,
    facts: deckFacts(slides.html),
    accent: deckAccent(deck.themeCss),
    hasInk: false,
    ink: null,
  };
}

/** A new deck with no file yet: it lives in the app's folder until its first Save. */
export async function createDraft(deck: DeckParts, generator: string): Promise<OpenDeck> {
  const opened = await openParts(deck, generator);
  const path = await invoke<string>("write_draft", { token: opened.token });
  return { ...opened, path, stamp: "" };
}

export function closeDeckFile(token: string): void {
  void invoke("close_deck", { token });
}

/** On Windows, WebView2 sees a custom scheme as http://<scheme>.localhost. */
export function deckUrl(token: string, view: "stage" | "sorter" = "stage"): string {
  const page = `http://penwork-deck.localhost/${token}/index.html`;
  return view === "sorter" ? `${page}?view=sorter` : page;
}

/** .pwpptx only. Raw .html is refused on purpose: the format exists so decks stay contained. */
export function isDeckPath(path: string): boolean {
  return path.toLowerCase().endsWith(".pwpptx");
}
