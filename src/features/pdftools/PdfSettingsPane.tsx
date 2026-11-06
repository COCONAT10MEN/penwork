import { Switch } from "../../ui";
import { PdfTab } from "../settings/FileSettingsTabs";
import { Section } from "../settings/parts";
import { FlatSections, ToolbarLive } from "../settings/settingsContexts";
import { useChoices } from "../settings/useChoices";
import styles from "./PdfTools.module.css";

/**
 * The PDF's settings, where the PDF is: the same ones as Home ▸ Settings ▸ PDF, plus Dark pages.
 * They take effect at once; the toolbar's go straight to the toolbar on this PDF.
 */
export function PdfSettingsPane({
  toToolbar,
}: {
  toToolbar: (settings: Record<string, unknown>) => void;
}) {
  const { settings, update } = useChoices();
  return (
    <div className={styles.settingsPane}>
      <FlatSections.Provider value={true}>
        <ToolbarLive.Provider value={toToolbar}>
          <Section title="Pages">
            <Switch
              label="Dark pages"
              description="Off keeps pages white."
              checked={settings.darkPages}
              onCheckedChange={(darkPages) => update({ darkPages })}
            />
          </Section>
          <PdfTab />
        </ToolbarLive.Provider>
      </FlatSections.Provider>
    </div>
  );
}
