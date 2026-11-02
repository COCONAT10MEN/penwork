import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { contrastRatio } from "../../lib/contrast";
import { checkLogo } from "../../lib/logo";
import { Button, ColorSwatches, LogoTile, Switch } from "../../ui";
import { showError } from "../notices/notices";
import { logoColor } from "./appearance";
import { Choice, ColorChoice, Section } from "./parts";
import { useChoices } from "./useChoices";
import { useSettings } from "./settingsStore";
import styles from "./Settings.module.css";

/** Below this a logo starts to disappear into its background (the rule for non-text shapes). */
const MIN_LOGO_CONTRAST = 3;

// Options to pick from, so these are data, not theme colours.
const PRESET_COLORS = ["#00687A", "#3F5BD4", "#7A4FBF", "#B4287A", "#C2410C", "#2E7D32"];

function LogoSection() {
  const { settings, update } = useChoices();
  const systemSeed = useSettings((s) => s.systemSeed);
  const { logo, logoBackground: background } = settings;
  const hardToSee = contrastRatio(logoColor(settings, systemSeed), background) < MIN_LOGO_CONTRAST;

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

export function AppearanceTab() {
  const { settings, update } = useChoices();
  return (
    <div className={styles.columns}>
      <Section title="Theme">
        <Choice
          label="App theme"
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
          value={settings.theme}
          onChange={(theme) => update({ theme })}
        />
        <Switch
          label="Dark pages"
          description="The pages of Word, Excel and PDF files go dark too. When this is off they stay white, like paper."
          checked={settings.darkPages}
          onCheckedChange={(darkPages) => update({ darkPages })}
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
        <Choice
          label="Where the colour comes from"
          options={[
            { value: "penwork", label: "Penwork teal" },
            { value: "logo", label: "Sync with logo" },
            { value: "deck", label: "Match the presentation" },
            { value: "custom", label: "Custom" },
          ]}
          value={settings.colorSource}
          onChange={(colorSource) => update({ colorSource })}
        />
        {settings.colorSource === "custom" && (
          <>
            <ColorSwatches
              label="Choose a colour"
              colors={PRESET_COLORS}
              value={settings.customColor}
              onChange={(customColor) => update({ customColor })}
            />
            <ColorChoice
              label="Change colour"
              value={settings.customColor}
              onChange={(customColor) => update({ customColor })}
            />
          </>
        )}
      </Section>
      <Section title="Background and size">
        <Switch
          label="Ambient colours"
          description="The soft colours behind Home and your files. Off gives a plain background."
          checked={settings.ambient}
          onCheckedChange={(ambient) => update({ ambient })}
        />
        <Choice
          label="Size of the app"
          options={[
            { value: 90, label: "Smaller" },
            { value: 100, label: "Normal" },
            { value: 110, label: "Larger" },
            { value: 125, label: "Largest" },
          ]}
          value={settings.uiScale}
          onChange={(uiScale) => update({ uiScale })}
        />
      </Section>
      <Section
        title="Transparency"
        hint="Reduced uses solid surfaces, which is easier on older laptops."
      >
        <Choice
          label="Glass"
          options={[
            { value: "auto", label: "Follow Windows" },
            { value: "glass", label: "Glass" },
            { value: "reduced", label: "Reduced" },
          ]}
          value={settings.transparency}
          onChange={(transparency) => update({ transparency })}
        />
      </Section>
      <LogoSection />
    </div>
  );
}
