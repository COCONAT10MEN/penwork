import { cleanLogoSvg } from "../../lib/logo";
import { isHexColor, type ThemeMode, type Transparency } from "../../theme/theme";

/** settings.json. Anything missing or damaged falls back to its default, one setting at a time. */

export type ColorSource = "logo" | "deck" | "custom";

export interface CustomLogo {
  /** Checked and cleaned by lib/logo before it gets here. */
  svg: string;
  color: string;
}

export interface Settings {
  version: 1;
  theme: ThemeMode;
  colorSource: ColorSource;
  customColor: string;
  logo: CustomLogo | null;
  logoBackground: string;
  transparency: Transparency;
  /** On: always reduced. Off: follows the Windows setting. */
  reduceMotion: boolean;
  /** What "next" does on the last slide of a show. Back to the first is the template's way. */
  endOfShow: "loop" | "stop";
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  theme: "system",
  colorSource: "logo",
  customColor: "#3F5BD4",
  logo: null,
  logoBackground: "#000000",
  transparency: "auto",
  reduceMotion: false,
  endOfShow: "loop",
};

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
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
    version: 1,
    theme: oneOf(d.theme, ["system", "light", "dark"], DEFAULT_SETTINGS.theme),
    colorSource: oneOf(d.colorSource, ["logo", "deck", "custom"], DEFAULT_SETTINGS.colorSource),
    customColor: hex(d.customColor, DEFAULT_SETTINGS.customColor),
    logo: readLogo(d.logo),
    logoBackground: hex(d.logoBackground, DEFAULT_SETTINGS.logoBackground),
    transparency: oneOf(
      d.transparency,
      ["auto", "glass", "reduced"],
      DEFAULT_SETTINGS.transparency,
    ),
    reduceMotion: d.reduceMotion === true,
    endOfShow: d.endOfShow === "stop" ? "stop" : "loop",
  };
}
