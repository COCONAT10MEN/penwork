/**
 * Moves images written into the slides as data: URLs out into assets, so large images don't sit
 * in undo history or bridge messages (docs/DECK-FORMAT.md §4). Identical images become one file.
 */

export interface ExtractedAsset {
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
}

const EXTENSIONS: Record<string, string> = {
  png: "png",
  jpeg: "jpg",
  jpg: "jpg",
  gif: "gif",
  webp: "webp",
  "svg+xml": "svg",
};

const DATA_IMAGE =
  /\b(src|href|xlink:href)="data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,([A-Za-z0-9+/=\s]+)"/g;

function decode(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function contentName(bytes: Uint8Array<ArrayBuffer>, extension: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hex = Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
  return `assets/${hex.slice(0, 32)}.${extension}`;
}

export async function extractImages(
  html: string,
): Promise<{ html: string; assets: ExtractedAsset[] }> {
  const assets = new Map<string, ExtractedAsset>();
  const names = new Map<string, string>();
  for (const match of html.matchAll(DATA_IMAGE)) {
    const [whole, , type, base64] = match;
    if (names.has(whole) || !type || !base64) continue;
    try {
      const bytes = decode(base64);
      const name = await contentName(bytes, EXTENSIONS[type] ?? "png");
      names.set(whole, name);
      assets.set(name, { name, bytes });
    } catch {
      // Not valid base64: left where it is, so the image simply stays broken as it was.
    }
  }
  const out = html.replace(DATA_IMAGE, (whole, attribute: string) => {
    const name = names.get(whole);
    return name ? `${attribute}="${name}"` : whole;
  });
  return { html: out, assets: Array.from(assets.values()) };
}
