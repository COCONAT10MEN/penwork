import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * The installed font a PDF's text was set in. A PDF names its fonts ("BCDEEE+Calibri-Bold",
 * "TimesNewRomanPSMT", "ArialMT"); the same font on this PC is found by that name, so edited words
 * are written in it, as Acrobat does. Fonts not installed fall back to the closest built-in kind.
 */

export type Generic = "sans" | "serif" | "mono";

/** How words are drawn: the CSS family on screen, and the installed font Save puts in the file. */
export interface Face {
  css: string;
  /** The font's name on Windows' list; none when it isn't installed (or can't go in a PDF). */
  installed?: string;
  generic: Generic;
  bold: boolean;
  italic: boolean;
}

export interface Installed {
  name: string;
  file: string;
}

const GENERIC_CSS: Record<Generic, string> = {
  sans: "Arial, Helvetica, sans-serif",
  serif: "'Times New Roman', Times, serif",
  mono: "'Courier New', Courier, monospace",
};

/** The PDF built-in fonts, and the Windows fonts drawn the same size. */
const ALIASES: Record<string, string> = {
  helvetica: "arial",
  arialmt: "arial",
  times: "timesnewroman",
  timesroman: "timesnewroman",
  courier: "couriernew",
};

let list: Promise<Installed[]> | null = null;
/** Windows' list of installed fonts, read once. */
export function installedFonts(): Promise<Installed[]> {
  list ??= isTauri() ? invoke<Installed[]>("installed_fonts").catch(() => []) : Promise.resolve([]);
  return list;
}

const files = new Map<string, Promise<Uint8Array | null>>();
/** One installed font's file, read once. */
export function installedFontFile(name: string): Promise<Uint8Array | null> {
  let f = files.get(name);
  if (!f) {
    f = invoke<ArrayBuffer>("installed_font_file", { name })
      .then((b) => new Uint8Array(b))
      .catch(() => null);
    files.set(name, f);
  }
  return f;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const STYLE_WORDS =
  /^(bold|black|heavy|semibold|demibold|demi|italic|oblique|regular|roman|normal|book|mt|ps|psmt)$/i;

/** "BCDEEE+TimesNewRomanPS-BoldItalicMT" → family "TimesNewRoman", extra "", bold, italic. */
export function parseFontName(raw: string) {
  const name = raw.replace(/^[A-Z]{6}\+/, "");
  const [familyPart = "", ...rest] = name.split(/[-,]/);
  const family = familyPart.replace(/(PSMT|PS|MT)$/, "");
  const words = rest
    .join(" ")
    .split(/(?<=[a-z])(?=[A-Z])|\s+/)
    .filter(Boolean);
  const style = words.join(" ");
  return {
    family,
    // Words that are part of the family on Windows: "Light", "Condensed", "Semilight".
    extra: words.filter((w) => !STYLE_WORDS.test(w)).join(""),
    bold: /bold|black|heavy|semibold|demi/i.test(style),
    italic: /italic|oblique/i.test(style),
  };
}

/** Windows' list by family and style: "Calibri Bold (TrueType)" → "calibribold". */
function byKey(fonts: Installed[]) {
  const map = new Map<string, Installed & { family: string }>();
  for (const f of fonts) {
    for (const one of f.name.replace(/\s*\((TrueType|OpenType)\)\s*$/i, "").split(" & ")) {
      const family = one.replace(/\s+(Bold|Italic|Regular|Oblique|Black)\b/gi, "").trim();
      const key = squash(one).replace(/regular$/, "");
      if (!map.has(key)) map.set(key, { ...f, family });
    }
  }
  return map;
}

let keyed: Promise<ReturnType<typeof byKey>> | null = null;

/**
 * The face for words set in the PDF font `pdfName`, as wanted: bold or not, slanted or not, and
 * Courier New for monospace.
 */
export async function faceFor(
  pdfName: string | null,
  generic: Generic,
  want: { bold: boolean; italic: boolean; mono?: boolean },
): Promise<Face> {
  keyed ??= installedFonts().then(byKey);
  return pickFace(await keyed, pdfName, generic, want);
}

/** As faceFor, from a list of installed fonts already read. */
export function matchFace(
  installed: Installed[],
  pdfName: string | null,
  generic: Generic,
  want: { bold: boolean; italic: boolean; mono?: boolean },
): Face {
  return pickFace(byKey(installed), pdfName, generic, want);
}

function pickFace(
  fonts: ReturnType<typeof byKey>,
  pdfName: string | null,
  generic: Generic,
  want: { bold: boolean; italic: boolean; mono?: boolean },
): Face {
  const parsed = want.mono ? { family: "CourierNew", extra: "" } : parseFontName(pdfName ?? "");
  const style = (want.bold ? "bold" : "") + (want.italic ? "italic" : "");
  const base = squash(parsed.family);
  const family = ALIASES[base] ?? base;
  const found =
    (parsed.extra && fonts.get(family + squash(parsed.extra) + style)) ||
    fonts.get(family + style) ||
    null;
  const kind: Generic = want.mono ? "mono" : generic;
  if (!found)
    return { css: GENERIC_CSS[kind], generic: kind, bold: want.bold, italic: want.italic };
  return {
    css: `'${found.family}', ${GENERIC_CSS[kind]}`,
    // A font collection (.ttc) can be shown but not put in a PDF by pdf-lib.
    ...(/\.(ttf|otf)$/i.test(found.file) ? { installed: found.name } : {}),
    generic: kind,
    bold: want.bold,
    italic: want.italic,
  };
}

/** The files of the installed fonts these faces use, for writing them into the PDF. */
export async function fontFiles(names: Iterable<string>): Promise<Record<string, Uint8Array>> {
  const out: Record<string, Uint8Array> = {};
  for (const name of new Set(names)) {
    const file = await installedFontFile(name);
    if (file) out[name] = file;
  }
  return out;
}
