import { useCallback, useEffect, type RefObject } from "react";
import { penworkLogoSvg } from "../../ui";
import { dockColors } from "../settings/appearance";
import { useSettings } from "../settings/settingsStore";
import type { RuntimeFrameHandle } from "./RuntimeFrame";

type Frame = RefObject<RuntimeFrameHandle | null>;

/** The sandboxed pages can't read the app's colours, so they're sent over, and again on a change. */
export function useFrameChrome(stageRef: Frame, sorterRef: Frame) {
  const systemSeed = useSettings((s) => s.systemSeed);

  const postChrome = useCallback(() => {
    const css = getComputedStyle(document.documentElement);
    const chrome = {
      accent: css.getPropertyValue("--md-sys-color-primary").trim(),
      onAccent: css.getPropertyValue("--md-sys-color-on-primary").trim(),
      text: css.getPropertyValue("--md-sys-color-on-surface").trim(),
      line: css.getPropertyValue("--md-sys-color-outline-variant").trim(),
      muted: css.getPropertyValue("--md-sys-color-on-surface-variant").trim(),
      scheme: css.colorScheme,
    };
    sorterRef.current?.post("chrome", chrome);
    stageRef.current?.post("chrome", chrome);
  }, [sorterRef, stageRef]);

  const postLogo = useCallback(() => {
    const { settings, systemSeed: seed } = useSettings.getState();
    stageRef.current?.post("logo", {
      svg: settings.logo?.svg ?? penworkLogoSvg(),
      ...dockColors(settings, seed),
    });
  }, [stageRef]);

  // The default theme follows Windows, which can change while a presentation is open.
  useEffect(() => {
    postChrome();
    postLogo();
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    dark.addEventListener("change", postChrome);
    return () => dark.removeEventListener("change", postChrome);
  }, [postChrome, postLogo, systemSeed]);

  return { postChrome, postLogo };
}
