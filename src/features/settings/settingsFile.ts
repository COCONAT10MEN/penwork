import { cleanLogoSvg } from "../../lib/logo";
import { isHexColor, type ThemeMode, type Transparency } from "../../theme/theme";

/** settings.json. Anything missing or damaged falls back to its default, one setting at a time. */

export type ColorSource = "penwork" | "logo" | "deck" | "custom";

export interface CustomLogo {
  /** Checked and cleaned by lib/logo before it gets here. */
  svg: string;
  color: string;
}

export interface Settings {
  version: 2;
  theme: ThemeMode;
  colorSource: ColorSource;
  customColor: string;
  logo: CustomLogo | null;
  logoBackground: string;
  transparency: Transparency;
  /** On: always reduced. Off: follows the Windows setting. */
  reduceMotion: boolean;
  /** Dark mode is for the app. Pages stay white like paper unless this is on. */
  darkPages: boolean;
  startOn: "home" | "last";
  /** How many recent files to list. Zero keeps them all. */
  recentLimit: number;
  filesView: "grid" | "list";
  filesSort: "recent" | "name" | "type";
  ambient: boolean;
  /** Size of everything in the app, in percent. */
  uiScale: number;
  animationSpeed: "slow" | "normal" | "fast";
  /** The bar, tools and page arriving one after another when a file opens. */
  openingAnimation: boolean;
  /** Where Save as starts. Null lets Windows choose. */
  saveFolder: string | null;
  /** Keep what Save replaced in the app's own folder. */
  keepPrevious: boolean;
  /** How often unsaved work in a presentation goes to its recovery copy. */
  recoverySeconds: number;
  wordRuler: boolean;
  wordOutline: boolean;
  wordAuthor: string;
  wordZoom: "fit" | "100" | "125" | "150";
  sheetFontSize: number;
  sheetGridlines: boolean;
  sheetZoom: number;
  pdfZoom: "page-fit" | "page-width" | "100";
  /** The top bar slides away while reading down a PDF, and comes back on the way up. */
  pdfHideBar: boolean;
  pdfTwoPages: boolean;
  /** Whether a new presentation starts with its ink saved into the file. */
  newKeepInk: boolean;
  /** What "next" does on the last slide of a show. Back to the first is the template's way. */
  endOfShow: "loop" | "stop";
}

export const DEFAULT_SETTINGS: Settings = {
  version: 2,
  theme: "system",
  colorSource: "penwork",
  customColor: "#00687A",
  logo: null,
  logoBackground: "#00363F",
  transparency: "auto",
  reduceMotion: false,
  darkPages: false,
  startOn: "home",
  recentLimit: 0,
  filesView: "grid",
  filesSort: "recent",
  ambient: true,
  uiScale: 100,
  animationSpeed: "normal",
  openingAnimation: true,
  saveFolder: null,
  keepPrevious: true,
  recoverySeconds: 5,
  wordRuler: false,
  wordOutline: true,
  wordAuthor: "",
  wordZoom: "fit",
  sheetFontSize: 10,
  sheetGridlines: true,
  sheetZoom: 1,
  pdfZoom: "page-width",
  pdfHideBar: false,
  pdfTwoPages: false,
  newKeepInk: true,
  endOfShow: "loop",
};

/** Before version 2 "logo" was simply the default, so nobody who has it chose it. */
function colorSourceOf(d: Record<string, unknown>): unknown {
  return d.version === 1 && d.colorSource === "logo" && !d.logo ? "penwork" : d.colorSource;
}
function logoBackgroundOf(d: Record<string, unknown>): unknown {
  return d.version === 1 && d.logoBackground === "#000000" ? undefined : d.logoBackground;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function choice<T>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function readLogo(value: unknown): CustomLogo | null {
  if (typeof value !== "object" || value === null) return null;
  const { svg, color } = value as { svg?: unknown; color?: unknown };
  // Cleaned again here: settings.json is a file on disk, and this ends up in the page.
  return typeof svg === "string" && typeof color === "string" && isHexColor(color)
    ? { svg: cleanLogoSvg(svg), color }
    : null;
}

export function parseSettings(text: string | null): Settings {
  if (!text) return DEFAULT_SETTINGS;
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return DEFAULT_SETTINGS;
  }
  const hex = (v: unknown, fallback: string) =>
    typeof v === "string" && isHexColor(v) ? v : fallback;
  return {
    version: 2,
    theme: oneOf(d.theme, ["system", "light", "dark"], DEFAULT_SETTINGS.theme),
    colorSource: oneOf(
      colorSourceOf(d),
      ["penwork", "logo", "deck", "custom"],
      DEFAULT_SETTINGS.colorSource,
    ),
    customColor: hex(d.customColor, DEFAULT_SETTINGS.customColor),
    logo: readLogo(d.logo),
    logoBackground: hex(logoBackgroundOf(d), DEFAULT_SETTINGS.logoBackground),
    transparency: oneOf(
      d.transparency,
      ["auto", "glass", "reduced"],
      DEFAULT_SETTINGS.transparency,
    ),
    reduceMotion: d.reduceMotion === true,
    darkPages: d.darkPages === true,
    startOn: d.startOn === "last" ? "last" : "home",
    recentLimit: choice(d.recentLimit, [0, 25, 50, 100], DEFAULT_SETTINGS.recentLimit),
    filesView: d.filesView === "list" ? "list" : "grid",
    filesSort: oneOf(d.filesSort, ["recent", "name", "type"], DEFAULT_SETTINGS.filesSort),
    ambient: d.ambient !== false,
    uiScale: choice(d.uiScale, [90, 100, 110, 125], DEFAULT_SETTINGS.uiScale),
    animationSpeed: oneOf(
      d.animationSpeed,
      ["slow", "normal", "fast"],
      DEFAULT_SETTINGS.animationSpeed,
    ),
    openingAnimation: d.openingAnimation !== false,
    saveFolder: typeof d.saveFolder === "string" && d.saveFolder ? d.saveFolder : null,
    keepPrevious: d.keepPrevious !== false,
    recoverySeconds: choice(d.recoverySeconds, [5, 15, 30, 60], DEFAULT_SETTINGS.recoverySeconds),
    wordRuler: d.wordRuler === true,
    wordOutline: d.wordOutline !== false,
    wordAuthor: typeof d.wordAuthor === "string" ? d.wordAuthor.slice(0, 80) : "",
    wordZoom: oneOf(d.wordZoom, ["fit", "100", "125", "150"], DEFAULT_SETTINGS.wordZoom),
    sheetFontSize: choice(d.sheetFontSize, [10, 11, 12, 14], DEFAULT_SETTINGS.sheetFontSize),
    sheetGridlines: d.sheetGridlines !== false,
    sheetZoom: choice(d.sheetZoom, [0.75, 1, 1.25, 1.5], DEFAULT_SETTINGS.sheetZoom),
    pdfZoom: oneOf(d.pdfZoom, ["page-fit", "page-width", "100"], DEFAULT_SETTINGS.pdfZoom),
    pdfHideBar: d.pdfHideBar === true,
    pdfTwoPages: d.pdfTwoPages === true,
    newKeepInk: d.newKeepInk !== false,
    endOfShow: d.endOfShow === "stop" ? "stop" : "loop",
  };
}
