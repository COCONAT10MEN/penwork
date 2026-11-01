import { snack } from "./demoAction";
import { useState } from "react";
import { Button, Dialog, IconButton, Menu, Slider, Switch, Tooltip } from "../../ui";
import { useGalleryMaterial } from "./galleryMaterial";
import { Section } from "./ShowcaseActions";
import styles from "./Gallery.module.css";

export function ShowcaseOverlays() {
  const material = useGalleryMaterial();
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [dialog, setDialog] = useState(false);
  return (
    <Section title="Menu · Dialog · Tooltip">
      <div className={styles.row}>
        <IconButton
          ref={setAnchor}
          icon="more_vert"
          label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        />
        <Menu
          open={menuOpen}
          anchor={anchor}
          label="More options"
          material={material}
          onClose={() => setMenuOpen(false)}
          items={[
            { label: "Open", icon: "open_in_new", trailing: "Enter", onSelect: () => {} },
            { label: "Add to favorites", icon: "star", onSelect: () => {} },
            { label: "Rename", icon: "edit", onSelect: () => {}, disabled: true },
            "divider",
            {
              label: "Remove from library",
              icon: "playlist_remove",
              onSelect: () =>
                snack({
                  message: "Removed from library",
                  actionLabel: "Undo",
                  onAction: () => {},
                  material,
                }),
            },
          ]}
        />
        <Button variant="tonal" onClick={() => setDialog(true)}>
          Open dialog
        </Button>
        <Tooltip text="Keeps your original file untouched" material={material}>
          <Button variant="text">Hover for tooltip</Button>
        </Tooltip>
      </div>
      <Dialog
        material={material}
        open={dialog}
        onClose={() => setDialog(false)}
        icon="playlist_remove"
        headline="Remove from library?"
        actions={
          <>
            <Button variant="text" onClick={() => setDialog(false)}>
              Cancel
            </Button>
            <Button variant="text" onClick={() => setDialog(false)}>
              Remove
            </Button>
          </>
        }
      >
        <p>The file stays on your computer. Only its place in Penwork's library is removed.</p>
      </Dialog>
    </Section>
  );
}

export function ShowcaseInputs() {
  const [dark, setDark] = useState(false);
  const [motion, setMotion] = useState(true);
  const [width, setWidth] = useState(4);
  const [zoom, setZoom] = useState(100);
  return (
    <Section title="Switch · Slider">
      <div className={styles.column}>
        <Switch label="Dark pages" checked={dark} onCheckedChange={setDark} />
        <Switch
          label="Animations"
          description="Springy motion for toolbars and menus"
          checked={motion}
          onCheckedChange={setMotion}
        />
        <Switch
          label="Pressure changes thickness"
          checked={false}
          onCheckedChange={() => {}}
          disabled
        />
        <Slider
          label="Thickness"
          value={width}
          min={1}
          max={12}
          format={(v) => `${v} pt`}
          onChange={setWidth}
        />
        <Slider
          label="Default zoom"
          value={zoom}
          min={50}
          max={200}
          step={10}
          format={(v) => `${v}%`}
          onChange={setZoom}
        />
        <Slider label="Disabled" value={30} onChange={() => {}} disabled />
      </div>
    </Section>
  );
}
