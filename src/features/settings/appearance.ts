import { applyTheme, PENWORK_SEED, setThemeMode, setTransparency } from "../../theme/theme";
import { DEFAULT_SETTINGS, type Settings } from "./settingsFile";

/** The logo on Home sits on the design's dark teal, so it takes the dark theme's teal. */
const PENWORK_LOGO = "#82D3E6";
const DOCK_BACKGROUND = "#000000";

/** The colour of the logo: its own for a custom logo, else teal or the Windows accent. */
export function logoColor(settings: Settings, systemSeed: string): string {
  return settings.logo?.color ?? (settings.colorSource === "penwork" ? PENWORK_LOGO : systemSeed);
}

/** Which colour the whole app is generated from (docs/DESIGN-GLASS.md §4). */
export function chromeSeed(
  settings: Settings,
  systemSeed: string,
  deckAccent: string | null,
): string {
  if (settings.colorSource === "penwork") return PENWORK_SEED;
  if (settings.colorSource === "custom") return settings.customColor;
  if (settings.colorSource === "deck" && deckAccent) return deckAccent;
  return logoColor(settings, systemSeed);
}

/**
 * The toolbar during a show keeps the template's look: the Windows accent on black, not the app's
 * teal, until a custom logo or a logo background picked in Settings says otherwise.
 */
export function dockColors(settings: Settings, systemSeed: string) {
  const picked = settings.logoBackground !== DEFAULT_SETTINGS.logoBackground;
  return {
    color: settings.logo?.color ?? systemSeed,
    background: picked ? settings.logoBackground : DOCK_BACKGROUND,
  };
}

let lastSeed: string | null = null;

/** Applies every setting to the page at once, which is what makes them instant. */
export function applyAppearance(
  settings: Settings,
  systemSeed: string,
  deckAccent: string | null,
  doc: Document = document,
): void {
  const root = doc.documentElement;
  setThemeMode(settings.theme, doc);
  setTransparency(settings.transparency, doc);
  if (settings.reduceMotion) root.dataset.reduceMotion = "";
  else delete root.dataset.reduceMotion;
  root.style.setProperty("--pw-logo-color", logoColor(settings, systemSeed));
  root.style.setProperty("--pw-logo-background", settings.logoBackground);

  // Rebuilding the theme repaints everything, so it only happens when the colour changes.
  const seed = chromeSeed(settings, systemSeed, deckAccent);
  if (seed !== lastSeed) {
    lastSeed = seed;
    applyTheme(seed, "tonalSpot", doc);
  }
}
