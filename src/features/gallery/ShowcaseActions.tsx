import { useState, type ReactNode } from "react";
import {
  Button,
  ButtonGroup,
  Chip,
  Fab,
  FabMenu,
  IconButton,
  SearchBar,
  SegmentedButton,
  useSnackbar,
} from "../../ui";
import { useGalleryMaterial } from "./galleryMaterial";
import styles from "./Gallery.module.css";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className="pw-type-title-medium pw-type--emphasized">{title}</h3>
      {children}
    </section>
  );
}

export function ShowcaseButtons() {
  return (
    <Section title="Buttons">
      {(["small", "medium", "large"] as const).map((size) => (
        <div key={size} className={styles.row}>
          <Button size={size} icon="edit">
            Filled
          </Button>
          <Button size={size} variant="tonal">
            Tonal
          </Button>
          <Button size={size} variant="outlined">
            Outlined
          </Button>
          <Button size={size} variant="text">
            Text
          </Button>
        </div>
      ))}
      <div className={styles.row}>
        <Button disabled>Disabled</Button>
        <Button variant="outlined" disabled>
          Disabled
        </Button>
      </div>
    </Section>
  );
}

export function ShowcaseIconButtons() {
  const [fav, setFav] = useState(true);
  const [bookmark, setBookmark] = useState(false);
  const [grid, setGrid] = useState(true);
  const [pin, setPin] = useState(false);
  return (
    <Section title="Icon buttons">
      <div className={styles.row}>
        <IconButton icon="search" label="Search" />
        <IconButton icon="edit" label="Edit" variant="filled" />
        <IconButton icon="share" label="Share" variant="tonal" />
        <IconButton icon="more_vert" label="More options" variant="outlined" />
        <IconButton icon="add" label="Add" variant="filled" size="medium" />
        <IconButton icon="delete" label="Delete" disabled />
      </div>
      <div className={styles.row}>
        <IconButton icon="star" label="Favorite" selected={fav} onClick={() => setFav(!fav)} />
        <IconButton
          icon="bookmark"
          label="Bookmark"
          variant="filled"
          selected={bookmark}
          onClick={() => setBookmark(!bookmark)}
        />
        <IconButton
          icon="grid_view"
          label="Grid view"
          variant="tonal"
          selected={grid}
          onClick={() => setGrid(!grid)}
        />
        <IconButton
          icon="push_pin"
          label="Pin"
          variant="outlined"
          selected={pin}
          onClick={() => setPin(!pin)}
        />
      </div>
    </Section>
  );
}

export function ShowcaseGroups() {
  const [tool, setTool] = useState("pen");
  const [style, setStyle] = useState<string[]>(["bold"]);
  const [range, setRange] = useState("week");
  return (
    <Section title="Button group · Segmented button">
      <ButtonGroup
        label="Tool"
        value={tool}
        onChange={setTool}
        options={[
          { value: "select", ariaLabel: "Select", icon: "arrow_selector_tool" },
          { value: "pen", ariaLabel: "Pen", icon: "stylus" },
          { value: "highlight", ariaLabel: "Highlighter", icon: "ink_highlighter" },
          { value: "erase", ariaLabel: "Eraser", icon: "ink_eraser" },
          { value: "text", ariaLabel: "Text", icon: "title" },
        ]}
      />
      <ButtonGroup
        label="Text style"
        value={style}
        onChange={setStyle}
        size="medium"
        options={[
          { value: "bold", label: "Bold", icon: "format_bold" },
          { value: "italic", label: "Italic", icon: "format_italic" },
          { value: "underline", label: "Underline", icon: "format_underlined" },
        ]}
      />
      <SegmentedButton
        label="Range"
        value={range}
        onChange={setRange}
        options={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
      />
    </Section>
  );
}

export function ShowcaseFabs() {
  const snack = useSnackbar();
  return (
    <Section title="FAB · FAB menu">
      <div className={styles.row}>
        <Fab icon="edit" label="Write" />
        <Fab icon="draw" label="Draw" color="secondary" />
        <Fab icon="add" label="Add" color="tertiary" />
        <Fab icon="add" label="Add" size="medium" />
        <Fab icon="add" label="Add" size="large" />
        <Fab icon="edit" label="New note" extended />
      </div>
      <div className={styles.fabStage}>
        <FabMenu
          label="Create"
          items={[
            {
              icon: "picture_as_pdf",
              label: "Import PDF",
              onSelect: () => snack({ message: "Import PDF chosen" }),
            },
            {
              icon: "book_2",
              label: "New notebook",
              onSelect: () => {},
              disabled: true,
              disabledReason: "Coming in a later update",
            },
            {
              icon: "sticky_note_2",
              label: "Quick note",
              onSelect: () => {},
              disabled: true,
              disabledReason: "Coming in a later update",
            },
          ]}
        />
      </div>
    </Section>
  );
}

export function ShowcaseChipsSearch() {
  const material = useGalleryMaterial();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  return (
    <Section title="Chips · Search bar">
      <div className={styles.row} role="group" aria-label="Filter">
        {["All", "Notebooks", "PDFs", "Favorites"].map((name) => (
          <Chip
            key={name}
            variant="filter"
            label={name}
            selected={filter === name.toLowerCase()}
            onClick={() => setFilter(name.toLowerCase())}
          />
        ))}
      </div>
      <div className={styles.row}>
        <Chip label="Open folder" icon="folder_open" />
        <Chip label="Recent" icon="schedule" />
        <Chip label="Disabled" icon="block" disabled />
      </div>
      <SearchBar
        label="Search presentations and slides"
        material={material}
        value={query}
        onChange={setQuery}
        trailing={<IconButton icon="account_circle" label="Account" variant="tonal" />}
      />
    </Section>
  );
}
