import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { getSystemSeed } from "../../theme/accent";
import {
  DEFAULT_SEED,
  applyTheme,
  setTransparency,
  type SchemeVariant,
  type Transparency,
} from "../../theme/theme";
import {
  AmbientBackground,
  Chip,
  IconButton,
  SegmentedButton,
  type SurfaceMaterial,
} from "../../ui";
import { GalleryMaterial } from "./galleryMaterial";
import {
  ShowcaseButtons,
  ShowcaseChipsSearch,
  ShowcaseFabs,
  ShowcaseGroups,
  ShowcaseIconButtons,
} from "./ShowcaseActions";
import {
  ShowcaseAppBar,
  ShowcaseCards,
  ShowcaseList,
  ShowcaseRail,
  ShowcaseTabs,
} from "./ShowcaseContainers";
import { ShowcaseInputs, ShowcaseOverlays } from "./ShowcaseOverlays";
import {
  ShowcaseFields,
  ShowcaseProgress,
  ShowcaseShapes,
  ShowcaseSplitSheet,
  ShowcaseSurfaces,
  ShowcaseToolbar,
} from "./ShowcaseGlass";
import { ShowcaseColors, ShowcaseType } from "./ShowcaseTokens";
import styles from "./Gallery.module.css";

const PRESETS = [
  { name: "Ink blue", hex: DEFAULT_SEED },
  { name: "Moss", hex: "#5B7F3A" },
  { name: "Ember", hex: "#C2410C" },
];

/** Every component, once in a forced-light panel and once in a forced-dark one. */
function Showcase({ scheme }: { scheme: "light" | "dark" }) {
  return (
    <div className={`${styles.panel} pw-theme-${scheme}`}>
      <div className={styles.ambient}>
        <AmbientBackground />
      </div>
      <h2 className="pw-type-headline-medium pw-type--emphasized">
        {scheme === "light" ? "Light" : "Dark"}
      </h2>
      <ShowcaseSurfaces />
      <ShowcaseToolbar />
      <ShowcaseButtons />
      <ShowcaseIconButtons />
      <ShowcaseGroups />
      <ShowcaseFabs />
      <ShowcaseChipsSearch />
      <ShowcaseRail />
      <ShowcaseTabs />
      <ShowcaseAppBar />
      <ShowcaseCards />
      <ShowcaseList />
      <ShowcaseOverlays />
      <ShowcaseInputs />
      <ShowcaseSplitSheet />
      <ShowcaseProgress />
      <ShowcaseFields />
      <ShowcaseShapes />
      <ShowcaseColors />
      <ShowcaseType />
    </div>
  );
}

/** Dev-only component gallery (Ctrl+Shift+G). Not included in release builds. */
export default function Gallery({ onClose }: { onClose: () => void }) {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [variant, setVariant] = useState<SchemeVariant>("tonalSpot");
  const [systemSeed, setSystemSeed] = useState<string | null>(null);
  const [material, setMaterial] = useState<SurfaceMaterial>("glass");
  const [transparency, setTransparencyMode] = useState<Transparency>("auto");

  useEffect(() => {
    // In a plain browser there is no Windows accent (it would just repeat Ink blue).
    if (isTauri()) void getSystemSeed().then(setSystemSeed);
  }, []);

  useEffect(() => {
    applyTheme(seed, variant);
  }, [seed, variant]);

  // Trying seeds here must not change the real app theme after the Gallery closes.
  useEffect(
    () => () => {
      void getSystemSeed().then((s) => applyTheme(s));
    },
    [],
  );

  useEffect(() => {
    setTransparency(transparency);
    return () => setTransparency("auto");
  }, [transparency]);

  const presets = systemSeed ? [{ name: "Windows accent", hex: systemSeed }, ...PRESETS] : PRESETS;

  return (
    <div className={styles.page}>
      <header className={styles.controls}>
        <h1 className="pw-type-title-large pw-type--emphasized">Gallery</h1>
        <div className={styles.control} role="group" aria-label="Seed color">
          <span className={`pw-type-label-large ${styles.controlLabel}`}>Seed</span>
          {presets.map((p) => (
            <Chip
              key={p.name}
              variant="filter"
              label={p.name}
              selected={seed.toLowerCase() === p.hex.toLowerCase()}
              onClick={() => setSeed(p.hex)}
            />
          ))}
          <input
            type="color"
            aria-label="Custom seed color"
            className={styles.colorInput}
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
          />
          <span className={`pw-type-label-large ${styles.seedHex}`}>{seed.toUpperCase()}</span>
        </div>
        <SegmentedButton
          label="Scheme"
          value={variant}
          onChange={(v) => setVariant(v as SchemeVariant)}
          options={[
            { value: "tonalSpot", label: "Tonal spot" },
            { value: "vibrant", label: "Vibrant" },
            { value: "expressive", label: "Expressive" },
          ]}
        />
        <SegmentedButton
          label="Material"
          value={material}
          onChange={(v) => setMaterial(v as SurfaceMaterial)}
          options={[
            { value: "glass", label: "Glass" },
            { value: "tonal", label: "Tonal" },
          ]}
        />
        <SegmentedButton
          label="Transparency"
          value={transparency}
          onChange={(v) => setTransparencyMode(v as Transparency)}
          options={[
            { value: "auto", label: "Auto" },
            { value: "glass", label: "Glass" },
            { value: "reduced", label: "Reduced" },
          ]}
        />
        <span style={{ flex: 1 }} />
        <IconButton icon="close" label="Close gallery (Ctrl+Shift+G)" onClick={onClose} />
      </header>
      <GalleryMaterial.Provider value={material}>
        <main className={styles.panels}>
          <Showcase scheme="light" />
          <Showcase scheme="dark" />
        </main>
      </GalleryMaterial.Provider>
    </div>
  );
}
