import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useState, type ReactNode } from "react";
import { checkLogo } from "../../lib/logo";
import {
  Button,
  ColorPicker,
  Dialog,
  LogoTile,
  SegmentedButton,
  Surface,
  Switch,
  useSnackbar,
} from "../../ui";
import type { ThemeMode, Transparency } from "../../theme/theme";
import type { ColorSource } from "./settingsFile";
import { useSettings } from "./settingsStore";
import styles from "./Settings.module.css";

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
        actions={<Button onClick={() => setOpen(false)}>Done</Button>}
      >
        <ColorPicker value={value} onChange={onChange} />
      </Dialog>
    </div>
  );
}

function LogoSection() {
  const notify = useSnackbar();
  const logo = useSettings((s) => s.settings.logo);
  const background = useSettings((s) => s.settings.logoBackground);
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
      notify({ message: result.message, duration: 10_000 });
      return;
    }
    update({ logo: { svg: result.svg, color: result.color } });
    if (result.color === background) {
      notify({ message: "Your logo and its background are the same colour. Change one of them." });
    }
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
    </Section>
  );
}

const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const COLORS = [
  { value: "logo", label: "Sync with logo" },
  { value: "deck", label: "Match the deck" },
  { value: "custom", label: "Custom" },
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
              ? "The app takes the deck's main colour while a deck is open."
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
