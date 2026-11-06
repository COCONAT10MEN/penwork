/** The PDF's own settings, as the Search tab finds them; each opens Settings at its row. */
export const SETTING_ROWS = [
  { label: "Dark pages", section: "Pages", words: "dark night black theme" },
  { label: "Starting zoom", section: "View", words: "zoom fit width whole page" },
  { label: "Hide the top bar while reading", section: "View", words: "bar hide full screen" },
  { label: "Two pages side by side", section: "View", words: "spread book two pages" },
  { label: "Editing", section: "View", words: "edit annotate pen read only lock" },
  {
    label: "Annotation toolbar",
    section: "Annotation toolbar",
    words: "toolbar buttons pen highlighter laser eraser undo redo order",
  },
] as const;

export type SettingRow = (typeof SETTING_ROWS)[number];
