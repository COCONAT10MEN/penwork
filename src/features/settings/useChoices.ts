import { useSettings } from "./settingsStore";

/** The settings and their one way of changing, for every tab. */
export function useChoices() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  return { settings, update };
}
