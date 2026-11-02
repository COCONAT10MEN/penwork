import { useState } from "react";
import { applyBrand, readBrand, type Brand } from "../../lib/deck/brand";
import { keepsInk, manifestSettings } from "../../lib/deck/manifest";
import type { DeckSlide } from "../../lib/deck/slideOps";
import { readThemeColors, setThemeColors, type ThemeColors } from "../../lib/deck/themeColors";
import { Button, ButtonGroup, ColorPicker, Dialog, Shape, Switch, TextField } from "../../ui";
import type { DeckMeta } from "./deckStore";
import styles from "./PresentationSettings.module.css";

const COLOURS: { key: keyof ThemeColors; label: string }[] = [
  { key: "teal", label: "Main" },
  { key: "or", label: "Second" },
  { key: "ink", label: "Headings" },
  { key: "paper", label: "Background" },
];

/** Everything that belongs to the whole presentation. Apply makes it all one undo step. */
function Form({
  meta,
  slides,
  onClose,
  onApply,
}: {
  meta: DeckMeta;
  slides: readonly DeckSlide[];
  onClose: () => void;
  onApply: (meta: DeckMeta, slides: DeckSlide[]) => void;
}) {
  const { manifest, theme } = meta;
  const title0 = typeof manifest.title === "string" ? manifest.title : "";
  const [title, setTitle] = useState(title0);
  const [brand, setBrand] = useState<Brand>(() => readBrand(manifest, title0, slides));
  const [colors, setColors] = useState<ThemeColors>(() => readThemeColors(theme));
  const [picking, setPicking] = useState<keyof ThemeColors | null>(null);
  const [lang, setLang] = useState(typeof manifest.lang === "string" ? manifest.lang : "en");
  const [dir, setDir] = useState(manifest.dir === "rtl" ? "rtl" : "ltr");
  const [keepInk, setKeepInk] = useState(keepsInk(manifest));
  const langOk = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(lang);

  const part = (key: keyof Brand, label: string) => (
    <TextField
      label={label}
      value={brand[key]}
      onChange={(value) => setBrand({ ...brand, [key]: value })}
    />
  );

  const apply = () => {
    onApply(
      {
        manifest: {
          ...manifest,
          title: title.trim() || title0,
          lang,
          dir,
          brand: {
            badgeWord: brand.word,
            badgeNumber: brand.number,
            deckName: brand.name,
            kicker: brand.kicker,
          },
          settings: { ...manifestSettings(manifest), keepInk },
        },
        theme: setThemeColors(theme, colors),
      },
      slides.map((slide) => ({ ...slide, html: applyBrand(slide.html, brand) })),
    );
    onClose();
  };

  return (
    <>
      <div className={styles.form}>
        <TextField label="Title" value={title} onChange={setTitle} />
        <div className={styles.pair}>
          {part("word", "Badge word")}
          {part("number", "Badge number")}
        </div>
        {part("name", "Name beside the badge")}
        {part("kicker", "Line above the cover title")}
        <fieldset className={styles.colors}>
          <legend className={styles.legend}>Colours</legend>
          {COLOURS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-label={`${label} colour`}
              aria-pressed={picking === key}
              className={`pw-state pw-press ${styles.color}`}
              onClick={() => setPicking(picking === key ? null : key)}
            >
              <Shape
                name={picking === key ? "Flower" : "Cookie9Sided"}
                size={40}
                solid
                color={colors[key]}
              />
              {label}
            </button>
          ))}
        </fieldset>
        {picking && (
          <ColorPicker
            value={colors[picking]}
            onChange={(hex) => setColors({ ...colors, [picking]: hex })}
          />
        )}
        <TextField
          label="Language"
          value={lang}
          supporting="A language code, such as en or ar."
          error={langOk ? undefined : "That isn't a language code."}
          onChange={setLang}
        />
        <ButtonGroup
          stretch
          label="Text direction"
          value={dir}
          options={[
            { value: "ltr", label: "Left to right" },
            { value: "rtl", label: "Right to left" },
          ]}
          onChange={setDir}
        />
        <Switch
          label="Keep ink in the presentation"
          description="When this is off, ink stays on this computer and isn't in the file."
          checked={keepInk}
          onCheckedChange={setKeepInk}
        />
      </div>
      <div className={styles.actions} data-press-group>
        <Button variant="text" size="medium" onClick={onClose}>
          Cancel
        </Button>
        <Button size="medium" disabled={!langOk} onClick={apply}>
          Apply
        </Button>
      </div>
    </>
  );
}

export function PresentationSettings({
  open,
  meta,
  slides,
  onClose,
  onApply,
}: {
  open: boolean;
  meta: DeckMeta;
  slides: readonly DeckSlide[];
  onClose: () => void;
  onApply: (meta: DeckMeta, slides: DeckSlide[]) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} headline="Presentation settings" material="glass">
      {open && <Form meta={meta} slides={slides} onClose={onClose} onApply={onApply} />}
    </Dialog>
  );
}
