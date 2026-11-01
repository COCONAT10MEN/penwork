import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useState, type ReactNode } from "react";
import { contrastRatio } from "../../lib/contrast";
import { checkLogo } from "../../lib/logo";
import { Button, ColorPicker, Dialog, LogoTile, SegmentedButton, Surface, Switch } from "../../ui";
import type { ThemeMode, Transparency } from "../../theme/theme";
import { showError } from "../notices/notices";
import { logoColor } from "./appearance";
import type { ColorSource, Settings as SavedSettings } from "./settingsFile";
import { useSettings } from "./settingsStore";
import styles from "./Settings.module.css";

/** Below this a logo starts to disappear into its background (the rule for non-text shapes). */
const MIN_LOGO_CONTRAST = 3;

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Surface material="glass" blur={false} className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      {hint && <p className={styles.hint}>{hint}</p>}
      {children}
    </Surface>
  );
}

function ColorChoice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.color}>
      <span className={styles.swatch} style={{ background: value }} aria-hidden="true" />
      <span className={styles.hex}>{value.toUpperCase()}</span>
      <Button variant="tonal" size="small" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        headline={label}
        material="glass"
        actions={
          <Button size="medium" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <ColorPicker value={value} onChange={onChange} />
      </Dialog>
    </div>
  );
}

function LogoSection() {
  const settings = useSettings((s) => s.settings);
  const systemSeed = useSettings((s) => s.systemSeed);
  const { logo, logoBackground: background } = settings;
  const hardToSee = contrastRatio(logoColor(settings, systemSeed), background) < MIN_LOGO_CONTRAST;
  const update = useSettings((s) => s.update);

  const choose = async () => {
    const path = await open({
      multiple: false,
      directory: false,
      // PNG and JPG are listed so that picking one gets an explanation, not a greyed-out file.
      filters: [{ name: "Logo", extensions: ["svg", "png", "jpg", "jpeg"] }],
    });
    if (typeof path !== "string") return;
    const text = path.toLowerCase().endsWith(".svg")
      ? await invoke<string>("read_logo_file", { path }).catch(() => "")
      : "";
    const result = checkLogo(path, text);
    if (!result.ok) {
      showError(result.message);
      return;
    }
    update({ logo: { svg: result.svg, color: result.color } });
  };

  return (
    <Section
      title="Logo"
      hint="An .svg file: square, one colour, transparent, 200 KB or smaller. Text must be converted to shapes."
    >
      <div className={styles.logoRow}>
        <LogoTile size={72} svg={logo?.svg} label="Logo preview" />
        <div className={styles.actions}>
          <Button variant="tonal" size="small" icon="upload" onClick={() => void choose()}>
            Choose logo
          </Button>
          {logo && (
            <Button variant="text" size="small" onClick={() => update({ logo: null })}>
              Use the Penwork logo
            </Button>
          )}
        </div>
      </div>
      <h3 className={styles.subtitle}>Logo background</h3>
      <ColorChoice
        label="Change background"
        value={background}
        onChange={(logoBackground) => update({ logoBackground })}
      />
      {hardToSee && (
        <p className={styles.hint} role="status">
          The logo is hard to see on this background.
        </p>
      )}
    </Section>
  );
}

const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const COLORS = [
  { value: "penwork", label: "Penwork teal" },
  { value: "logo", label: "Sync with logo" },
  { value: "deck", label: "Match the presentation" },
  { value: "custom", label: "Custom" },
];
const END_OF_SHOW = [
  { value: "loop", label: "Back to the first" },
  { value: "stop", label: "Stay on it" },
];
const TRANSPARENCY = [
  { value: "auto", label: "Follow Windows" },
  { value: "glass", label: "Glass" },
  { value: "reduced", label: "Reduced" },
];

export function Settings() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  return (
    <div className={styles.settings}>
      <h1 className={styles.heading}>Settings</h1>
      <div className={styles.columns}>
        <Section title="Theme">
          <SegmentedButton
            label="Theme"
            required
            options={THEMES}
            value={settings.theme}
            onChange={(theme) => update({ theme: theme as ThemeMode })}
          />
        </Section>
        <Section
          title="App colour"
          hint={
            settings.colorSource === "deck"
              ? "The app takes the presentation's main colour while one is open."
              : undefined
          }
        >
          <SegmentedButton
            label="App colour"
            required
            options={COLORS}
            value={settings.colorSource}
            onChange={(colorSource) => update({ colorSource: colorSource as ColorSource })}
          />
          {settings.colorSource === "custom" && (
            <ColorChoice
              label="Change colour"
              value={settings.customColor}
              onChange={(customColor) => update({ customColor })}
            />
          )}
        </Section>
        <LogoSection />
        <Section
          title="Transparency"
          hint="Reduced uses solid surfaces, which is easier on older laptops."
        >
          <SegmentedButton
            label="Transparency"
            required
            options={TRANSPARENCY}
            value={settings.transparency}
            onChange={(transparency) => update({ transparency: transparency as Transparency })}
          />
        </Section>
        <Section title="Last slide of a show">
          <SegmentedButton
            label="Last slide of a show"
            required
            options={END_OF_SHOW}
            value={settings.endOfShow}
            onChange={(endOfShow) => update({ endOfShow: endOfShow as SavedSettings["endOfShow"] })}
          />
        </Section>
        <Section title="Motion">
          <Switch
            label="Reduce motion"
            description="When this is off, Penwork follows your Windows setting."
            checked={settings.reduceMotion}
            onCheckedChange={(reduceMotion) => update({ reduceMotion })}
          />
        </Section>
      </div>
    </div>
  );
}
