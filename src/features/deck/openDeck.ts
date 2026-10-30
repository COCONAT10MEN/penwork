import { invoke } from "@tauri-apps/api/core";
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
}

interface OpenedFromRust {
  token: string;
  path: string;
  content: { manifest: unknown; slidesHtml: string };
}

export interface DeckError {
  code: string;
  message: string;
}

export function isDeckError(value: unknown): value is DeckError {
  return typeof value === "object" && value !== null && "code" in value && "message" in value;
}

export async function openDeckFile(path: string): Promise<OpenDeck> {
  const opened = await invoke<OpenedFromRust>("open_deck", { path });
  const clean = sanitizeSlides(opened.content.slidesHtml);
  // Rust only serves slides after this, so nothing unsanitised ever reaches the slide page.
  await invoke("set_deck_slides", { token: opened.token, html: clean.html });
  return {
    token: opened.token,
    path: opened.path,
    manifest: readManifest(opened.content.manifest, fileTitle(path)),
    slideCount: clean.slideCount,
    removed: clean.removed,
  };
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
