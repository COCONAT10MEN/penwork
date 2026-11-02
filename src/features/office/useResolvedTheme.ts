import { useEffect, useState } from "react";
import { useSettings } from "../settings/settingsStore";

/** The theme on screen. The "system" setting becomes whichever one Windows is using. */
export function useResolvedTheme(): "light" | "dark" {
  const setting = useSettings((s) => s.settings.theme);
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  if (setting !== "system") return setting;
  return systemDark ? "dark" : "light";
}
