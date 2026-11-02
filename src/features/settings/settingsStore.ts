import { invoke, isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { setRecentLimit, useApp } from "../../appStore";
import { getSystemSeed, onSystemSeedChange } from "../../theme/accent";
import { DEFAULT_SEED } from "../../theme/theme";
import { applyAppearance } from "./appearance";
import { DEFAULT_SETTINGS, parseSettings, type Settings } from "./settingsFile";

interface SettingsState {
  settings: Settings;
  /** The Windows accent colour, kept here so the default logo can follow it. */
  systemSeed: string;
  update: (change: Partial<Settings>) => void;
}

export const useSettings = create<SettingsState>(() => ({
  settings: DEFAULT_SETTINGS,
  systemSeed: DEFAULT_SEED,
  update: () => {},
}));

let saveTimer: ReturnType<typeof setTimeout> | undefined;

// A colour picker changes many times a second. The page updates each time, the disk once.
function saveSoon(settings: Settings): void {
  if (!isTauri()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void invoke("write_app_file", {
      name: "settings.json",
      text: JSON.stringify(settings, null, 2),
    });
  }, 300);
}

let scale = 100;

function apply(): void {
  const { settings, systemSeed } = useSettings.getState();
  applyAppearance(settings, systemSeed, useApp.getState().deck?.accent ?? null);
  setRecentLimit(settings.recentLimit);
  if (settings.uiScale !== scale && isTauri()) {
    scale = settings.uiScale;
    void getCurrentWebview().setZoom(scale / 100);
  }
}

/** Loads settings and starts keeping the page in step. Runs before the first render. */
export async function startSettings(): Promise<void> {
  useSettings.setState({
    update: (change) => {
      const settings = { ...useSettings.getState().settings, ...change };
      useSettings.setState({ settings });
      apply();
      saveSoon(settings);
    },
  });

  const [text, systemSeed] = await Promise.all([
    isTauri()
      ? invoke<string | null>("read_app_file", { name: "settings.json" }).catch(() => null)
      : Promise.resolve(null),
    getSystemSeed(),
  ]);
  useSettings.setState({ settings: parseSettings(text), systemSeed });
  apply();

  useApp.subscribe((state, previous) => {
    if (state.deck?.accent !== previous.deck?.accent) apply();
  });
  void onSystemSeedChange((seed) => {
    useSettings.setState({ systemSeed: seed });
    apply();
  });
}
