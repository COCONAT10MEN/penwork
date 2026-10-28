import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { DEFAULT_SEED, isHexColor } from "./theme";

// Outside Tauri (plain browser during development) there is no Rust side, so use Ink blue.

/** The Windows accent color as #RRGGBB, or Ink blue when it can't be read. */
export async function getSystemSeed(): Promise<string> {
  if (!isTauri()) return DEFAULT_SEED;
  try {
    const hex = await invoke<string | null>("get_accent_color");
    return hex && isHexColor(hex) ? hex : DEFAULT_SEED;
  } catch {
    return DEFAULT_SEED;
  }
}

/** Calls back with the new seed when the user changes the accent color in Windows Settings. */
export async function onSystemSeedChange(callback: (seed: string) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  return listen<string | null>("accent-color-changed", (event) => {
    const hex = event.payload;
    callback(hex && isHexColor(hex) ? hex : DEFAULT_SEED);
  });
}
