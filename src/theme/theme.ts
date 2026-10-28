import {
  type DynamicScheme,
  Hct,
  SchemeExpressive,
  SchemeTonalSpot,
  SchemeVibrant,
  argbFromHex,
  hexFromArgb,
} from "@material/material-color-utilities";

export const DEFAULT_SEED = "#3F5BD4"; // Ink blue
export type SchemeVariant = "tonalSpot" | "vibrant" | "expressive";
export type ThemeMode = "system" | "light" | "dark";
export type ColorRoles = Record<string, string>;

// CSS role name → DynamicScheme getter. Kept explicit so a library rename fails typecheck, not silently.
const ROLES = {
  primary: (s) => s.primary,
  "on-primary": (s) => s.onPrimary,
  "primary-container": (s) => s.primaryContainer,
  "on-primary-container": (s) => s.onPrimaryContainer,
  "inverse-primary": (s) => s.inversePrimary,
  "primary-fixed": (s) => s.primaryFixed,
  "primary-fixed-dim": (s) => s.primaryFixedDim,
  "on-primary-fixed": (s) => s.onPrimaryFixed,
  "on-primary-fixed-variant": (s) => s.onPrimaryFixedVariant,
  secondary: (s) => s.secondary,
  "on-secondary": (s) => s.onSecondary,
  "secondary-container": (s) => s.secondaryContainer,
  "on-secondary-container": (s) => s.onSecondaryContainer,
  tertiary: (s) => s.tertiary,
  "on-tertiary": (s) => s.onTertiary,
  "tertiary-container": (s) => s.tertiaryContainer,
  "on-tertiary-container": (s) => s.onTertiaryContainer,
  error: (s) => s.error,
  "on-error": (s) => s.onError,
  "error-container": (s) => s.errorContainer,
  "on-error-container": (s) => s.onErrorContainer,
  background: (s) => s.background,
  "on-background": (s) => s.onBackground,
  surface: (s) => s.surface,
  "surface-dim": (s) => s.surfaceDim,
  "surface-bright": (s) => s.surfaceBright,
  "surface-container-lowest": (s) => s.surfaceContainerLowest,
  "surface-container-low": (s) => s.surfaceContainerLow,
  "surface-container": (s) => s.surfaceContainer,
  "surface-container-high": (s) => s.surfaceContainerHigh,
  "surface-container-highest": (s) => s.surfaceContainerHighest,
  "surface-variant": (s) => s.surfaceVariant,
  "on-surface": (s) => s.onSurface,
  "on-surface-variant": (s) => s.onSurfaceVariant,
  "inverse-surface": (s) => s.inverseSurface,
  "inverse-on-surface": (s) => s.inverseOnSurface,
  "surface-tint": (s) => s.surfaceTint,
  outline: (s) => s.outline,
  "outline-variant": (s) => s.outlineVariant,
  shadow: (s) => s.shadow,
  scrim: (s) => s.scrim,
} satisfies Record<string, (s: DynamicScheme) => number>;

export const ROLE_NAMES = Object.keys(ROLES);

function makeScheme(seed: Hct, dark: boolean, variant: SchemeVariant): DynamicScheme {
  // "2025" is the Material 3 Expressive color spec.
  switch (variant) {
    case "vibrant":
      return new SchemeVibrant(seed, dark, 0, "2025");
    case "expressive":
      return new SchemeExpressive(seed, dark, 0, "2025");
    case "tonalSpot":
      return new SchemeTonalSpot(seed, dark, 0, "2025");
  }
}

function roles(scheme: DynamicScheme): ColorRoles {
  const out: ColorRoles = {};
  for (const [name, get] of Object.entries(ROLES)) out[name] = hexFromArgb(get(scheme));
  return out;
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

/** All color roles for light and dark, from one seed color. */
export function generateColors(
  seedHex: string,
  variant: SchemeVariant = "tonalSpot",
): { light: ColorRoles; dark: ColorRoles } {
  const seed = Hct.fromInt(argbFromHex(isHexColor(seedHex) ? seedHex : DEFAULT_SEED));
  return {
    light: roles(makeScheme(seed, false, variant)),
    dark: roles(makeScheme(seed, true, variant)),
  };
}

function block(selector: string, colors: ColorRoles, scheme: "light" | "dark"): string {
  const vars = Object.entries(colors)
    .map(([name, hex]) => `  --md-sys-color-${name}: ${hex};`)
    .join("\n");
  return `${selector} {\n  color-scheme: ${scheme};\n${vars}\n}`;
}

/**
 * CSS for both schemes. `.pw-theme-light` / `.pw-theme-dark` force a scheme on any element
 * (the Gallery uses them for side-by-side panels); the root follows the OS unless
 * `data-theme` overrides it (Settings, M2).
 */
export function themeCss(colors: { light: ColorRoles; dark: ColorRoles }): string {
  return [
    block(':root, .pw-theme-light, :root[data-theme="light"]', colors.light, "light"),
    `@media (prefers-color-scheme: dark) {\n${block(':root:not([data-theme="light"])', colors.dark, "dark")}\n}`,
    block(':root[data-theme="dark"], .pw-theme-dark', colors.dark, "dark"),
  ].join("\n\n");
}

const STYLE_ID = "pw-theme";

/** Writes (or rewrites) the generated theme into a <style> tag, so changes repaint instantly. */
export function applyTheme(
  seedHex: string,
  variant: SchemeVariant = "tonalSpot",
  doc: Document = document,
): void {
  let style = doc.getElementById(STYLE_ID);
  if (!style) {
    style = doc.createElement("style");
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = themeCss(generateColors(seedHex, variant));
}

/** "system" removes the override so the OS light/dark setting decides. */
export function setThemeMode(mode: ThemeMode, doc: Document = document): void {
  if (mode === "system") delete doc.documentElement.dataset.theme;
  else doc.documentElement.dataset.theme = mode;
}
