import { useState } from "react";
import {
  Breadcrumb,
  Button,
  CircularProgress,
  ColorPicker,
  FloatingToolbar,
  IconButton,
  LinearProgress,
  LoadingIndicator,
  PenworkLogo,
  SideSheet,
  SplitButton,
  Surface,
  TextField,
  ToolbarDivider,
  useSnackbar,
} from "../../ui";
import { CLOVER_PATH, COOKIE_PATH } from "../../ui/shapes";
import { useGalleryMaterial } from "./galleryMaterial";
import { Section } from "./ShowcaseActions";
import styles from "./Gallery.module.css";

export function ShowcaseSurfaces() {
  return (
    <Section title="Surface (glass strengths · solid · tonal)">
      <div className={styles.surfaces}>
        <Surface strength="thin" className={styles.surface}>
          <b>Thin</b>
          <b>Chips and status</b>
        </Surface>
        <Surface strength="regular" floating className={styles.surface}>
          <b>Regular</b>
          <span>Dock, top bar, panels</span>
        </Surface>
        <Surface strength="thick" className={styles.surface}>
          <b>Thick</b>
          <span>Lots of text</span>
        </Surface>
        <Surface solid strength="thick" floating className={styles.surface}>
          <b>Solid</b>
          <span>Popovers and menus</span>
        </Surface>
        <Surface material="tonal" className={styles.surface}>
          <b>Tonal</b>
          <span>Reduced transparency</span>
        </Surface>
      </div>
    </Section>
  );
}

export function ShowcaseToolbar() {
  const material = useGalleryMaterial();
  const [open, setOpen] = useState(true);
  const [tool, setTool] = useState("pen");
  const [vertOpen, setVertOpen] = useState(true);
  const tools = [
    ["pointer", "arrow_selector_tool", "Pointer"],
    ["pen", "stylus", "Pen"],
    ["marker", "ink_highlighter", "Highlighter"],
    ["eraser", "ink_eraser", "Eraser"],
  ] as const;
  return (
    <Section title="Floating toolbar (click the logo: one body, no bounce)">
      <div className={styles.toolbarStage}>
        <FloatingToolbar
          label="Tools"
          open={open}
          onOpenChange={setOpen}
          logo={<PenworkLogo size={36} />}
          material={material}
        >
          {tools.map(([id, icon, label]) => (
            <IconButton
              key={id}
              variant="tool"
              icon={icon}
              label={label}
              selected={tool === id}
              onClick={() => setTool(id)}
            />
          ))}
          <ToolbarDivider />
          <IconButton variant="tool" icon="undo" label="Undo" />
          <IconButton variant="tool" icon="redo" label="Redo" />
        </FloatingToolbar>
        <FloatingToolbar
          label="Vertical tools"
          open={vertOpen}
          onOpenChange={setVertOpen}
          logo={<PenworkLogo size={36} />}
          orientation="vertical"
          material={material}
        >
          <IconButton variant="tool" icon="stylus" label="Pen" selected />
          <IconButton variant="tool" icon="ink_eraser" label="Eraser" />
        </FloatingToolbar>
      </div>
    </Section>
  );
}

export function ShowcaseProgress() {
  const [value, setValue] = useState(0.62);
  return (
    <Section title="Progress · Loading indicator">
      <div className={styles.column}>
        <LinearProgress label="Wavy" value={value} />
        <LinearProgress label="Flat" value={value} wavy={false} />
        <LinearProgress label="Unknown length" />
        <LinearProgress label="Unknown length, flat" wavy={false} />
        <div className={styles.row}>
          <CircularProgress label="Circular" value={value} />
          <CircularProgress label="Circular, unknown length" />
          <LoadingIndicator label="Loading" />
          <Button variant="outlined" onClick={() => setValue((v) => (v + 0.13) % 1)}>
            Change value
          </Button>
        </div>
      </div>
    </Section>
  );
}

export function ShowcaseFields() {
  const [color, setColor] = useState("#e5352b");
  const [saved, setSaved] = useState<string[]>([]);
  const [heading, setHeading] = useState("What it means");
  const [title, setTitle] = useState("A slide title that is far too long to fit on one line");
  return (
    <Section title="Text field · Breadcrumb · Color picker">
      <div className={styles.row}>
        <div className={`${styles.column} ${styles.fields}`}>
          <TextField label="Heading" value={heading} onChange={setHeading} />
          <TextField
            label="Title"
            value={title}
            onChange={setTitle}
            error={
              title.length > 36 ? "Titles fit on one line up to about 36 characters" : undefined
            }
          />
          <TextField
            label="Kicker"
            value=""
            onChange={() => {}}
            placeholder="Physics · Unit 3"
            supporting="Shown on the cover"
          />
          <TextField label="Disabled" value="Read only" onChange={() => {}} disabled />
          <Breadcrumb
            label="Selection"
            items={[
              { id: "slide", label: "Slide 2", onClick: () => {} },
              { id: "columns", label: "Columns", onClick: () => {} },
              { id: "card", label: "Card" },
            ]}
          />
        </div>
        <div className={styles.column}>
          <ColorPicker
            value={color}
            onChange={setColor}
            onSave={(hex) => setSaved((s) => [hex, ...s.filter((c) => c !== hex)].slice(0, 3))}
          />
          <span className="pw-type-body-small">Saved: {saved.join(", ") || "none yet"}</span>
        </div>
      </div>
    </Section>
  );
}

export function ShowcaseSplitSheet() {
  const material = useGalleryMaterial();
  const snack = useSnackbar();
  const [sheet, setSheet] = useState(false);
  const items = [
    { label: "Save as", icon: "save_as", onSelect: () => snack({ message: "Save as", material }) },
    { label: "Export PDF", icon: "picture_as_pdf", onSelect: () => {} },
  ];
  return (
    <Section title="Split button · Side sheet">
      <div className={styles.row}>
        <SplitButton
          label="Save"
          icon="save"
          menuLabel="More save options"
          items={items}
          menuMaterial={material}
          onClick={() => snack({ message: "Saved", material })}
        />
        <SplitButton
          label="Present"
          variant="tonal"
          menuLabel="More present options"
          items={items}
          menuMaterial={material}
          onClick={() => {}}
        />
        <Button variant="outlined" onClick={() => setSheet((o) => !o)}>
          Toggle side sheet
        </Button>
      </div>
      <div className={styles.sheetStage}>
        <SideSheet
          open={sheet}
          onClose={() => setSheet(false)}
          title="Inspector"
          material={material}
          strength="thick"
        >
          <p className="pw-type-body-medium">
            A panel beside the content. Press Esc inside it to close.
          </p>
        </SideSheet>
      </div>
    </Section>
  );
}

export function ShowcaseShapes() {
  return (
    <Section title="Logo · Expressive shapes">
      <div className={styles.row}>
        <span className={styles.logoChip}>
          <PenworkLogo size={56} label="Penwork" />
        </span>
        <span className={`${styles.logoChip} ${styles.logoChipOpen}`}>
          <PenworkLogo size={56} />
        </span>
        <svg
          width="56"
          height="56"
          viewBox="0 0 100 100"
          className={styles.shape}
          aria-hidden="true"
        >
          <path d={COOKIE_PATH} />
        </svg>
        <svg
          width="56"
          height="56"
          viewBox="0 0 100 100"
          className={styles.shape}
          aria-hidden="true"
        >
          <path d={CLOVER_PATH} />
        </svg>
      </div>
    </Section>
  );
}
