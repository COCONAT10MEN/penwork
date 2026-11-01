// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { applyAppearance, chromeSeed, dockColors, logoColor } from "./appearance";
import { PENWORK_SEED } from "../../theme/theme";
import { DEFAULT_SETTINGS, parseSettings, type Settings } from "./settingsFile";

const WINDOWS = "#0078D4";
const logo = { svg: '<svg viewBox="0 0 10 10"></svg>', color: "#e5352b" };
const with_ = (change: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...change });

describe("parseSettings", () => {
  it("uses the defaults when there is no file or it's damaged", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{nope")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps good values and replaces only the bad ones", () => {
    const parsed = parseSettings(
      JSON.stringify({ theme: "dark", logoBackground: "red", transparency: "nonsense" }),
    );
    expect(parsed.theme).toBe("dark");
    expect(parsed.logoBackground).toBe(DEFAULT_SETTINGS.logoBackground);
    expect(parsed.transparency).toBe("auto");
  });

  it("cleans a saved logo again, because the file could have been changed", () => {
    const svg = '<svg viewBox="0 0 10 10"><path d="M0 0" onclick="boom()"></path></svg>';
    const parsed = parseSettings(JSON.stringify({ logo: { svg, color: "#112233" } }));
    expect(parsed.logo?.svg).not.toContain("onclick");
  });

  it("drops a damaged logo", () => {
    expect(parseSettings(JSON.stringify({ logo: { svg: 1 } })).logo).toBeNull();
    expect(parseSettings(JSON.stringify({ logo })).logo).toEqual(logo);
  });
});

describe("app colour", () => {
  it("defaults to Penwork's teal, whatever Windows is set to", () => {
    expect(chromeSeed(DEFAULT_SETTINGS, WINDOWS, null)).toBe(PENWORK_SEED);
    expect(logoColor(DEFAULT_SETTINGS, WINDOWS)).not.toBe(WINDOWS);
    expect(dockColors(DEFAULT_SETTINGS, WINDOWS)).toEqual({
      color: WINDOWS,
      background: "#000000",
    });
  });

  it("follows the Windows accent when the logo setting is chosen", () => {
    const settings = with_({ colorSource: "logo" });
    expect(logoColor(settings, WINDOWS)).toBe(WINDOWS);
    expect(chromeSeed(settings, WINDOWS, null)).toBe(WINDOWS);
  });

  it("moves settings from before teal was the default onto it", () => {
    const old = parseSettings(
      JSON.stringify({ version: 1, colorSource: "logo", logoBackground: "#000000" }),
    );
    expect(old.colorSource).toBe("penwork");
    expect(old.logoBackground).toBe(DEFAULT_SETTINGS.logoBackground);
    const chosen = parseSettings(JSON.stringify({ version: 2, colorSource: "logo" }));
    expect(chosen.colorSource).toBe("logo");
  });

  it("uses a custom logo's own colour", () => {
    expect(chromeSeed(with_({ logo, colorSource: "logo" }), WINDOWS, "#00ff00")).toBe(logo.color);
  });

  it("matches the deck only while one is open", () => {
    const settings = with_({ colorSource: "deck" });
    expect(chromeSeed(settings, WINDOWS, "#00ff00")).toBe("#00ff00");
    expect(chromeSeed(settings, WINDOWS, null)).toBe(WINDOWS);
  });

  it("lets a custom colour win", () => {
    const settings = with_({ colorSource: "custom", customColor: "#123456", logo });
    expect(chromeSeed(settings, WINDOWS, "#00ff00")).toBe("#123456");
  });
});

describe("applyAppearance", () => {
  it("applies every setting to the page", () => {
    const doc = document.implementation.createHTMLDocument();
    applyAppearance(
      with_({
        theme: "dark",
        transparency: "reduced",
        reduceMotion: true,
        logoBackground: "#ffffff",
        colorSource: "logo",
      }),
      WINDOWS,
      null,
      doc,
    );
    const root = doc.documentElement;
    expect(root.dataset.theme).toBe("dark");
    expect(root.dataset.transparency).toBe("reduced");
    expect(root.dataset.reduceMotion).toBe("");
    expect(root.style.getPropertyValue("--pw-logo-background")).toBe("#ffffff");
    expect(root.style.getPropertyValue("--pw-logo-color")).toBe(WINDOWS);
  });

  it("clears what it set when a setting goes back", () => {
    const doc = document.implementation.createHTMLDocument();
    applyAppearance(with_({ theme: "dark", reduceMotion: true }), WINDOWS, null, doc);
    applyAppearance(DEFAULT_SETTINGS, WINDOWS, null, doc);
    expect(doc.documentElement.dataset.theme).toBeUndefined();
    expect(doc.documentElement.dataset.reduceMotion).toBeUndefined();
  });
});
