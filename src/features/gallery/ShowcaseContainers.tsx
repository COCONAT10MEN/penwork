import { snack } from "./demoAction";
import { useState } from "react";
import {
  Button,
  Card,
  IconButton,
  List,
  ListIcon,
  ListItem,
  NavigationRail,
  Tabs,
  TopAppBar,
  type RailItem,
} from "../../ui";
import { useGalleryMaterial } from "./galleryMaterial";
import { Section } from "./ShowcaseActions";
import styles from "./Gallery.module.css";

const RAIL_ITEMS: RailItem[] = [
  { id: "library", label: "Library", icon: "home" },
  { id: "pdfs", label: "PDFs", icon: "picture_as_pdf" },
  { id: "notebooks", label: "Notebooks", icon: "book_2" },
  { id: "favorites", label: "Favorites", icon: "star" },
  { id: "trash", label: "Trash", icon: "delete", badge: 3 },
];

export function ShowcaseRail() {
  const material = useGalleryMaterial();
  const [page, setPage] = useState("library");
  return (
    <Section title="Navigation rail (wide · icons · slim)">
      <div className={styles.railBox}>
        <NavigationRail
          label="Main (wide example)"
          material={material}
          layout="wide"
          items={RAIL_ITEMS}
          value={page}
          onChange={setPage}
          header={<span className="pw-type-title-large pw-type--emphasized">Penwork</span>}
          footer={<IconButton icon="settings" label="Settings" />}
        />
        <NavigationRail
          label="Main (narrow example)"
          material={material}
          layout="icons"
          items={RAIL_ITEMS}
          value={page}
          onChange={setPage}
          footer={<IconButton icon="settings" label="Settings" tooltipPlacement="right" />}
        />
        <NavigationRail
          label="Main (slim example)"
          material={material}
          layout="stacked"
          items={RAIL_ITEMS}
          value={page}
          onChange={setPage}
        />
      </div>
    </Section>
  );
}

export function ShowcaseAppBar() {
  const material = useGalleryMaterial();
  return (
    <Section title="Top app bar">
      <div>
        <TopAppBar
          material={material}
          title="Physics — Waves.pdf"
          subtitle="Page 3 of 48 · 2 annotations"
          leading={<IconButton icon="arrow_back" label="Back" />}
          actions={
            <>
              <IconButton icon="search" label="Find in document" />
              <Button variant="tonal" icon="signature">
                Sign
              </Button>
              <Button icon="save">Save copy</Button>
            </>
          }
        />
      </div>
    </Section>
  );
}

export function ShowcaseCards() {
  const material = useGalleryMaterial();
  return (
    <Section title="Cards">
      <div className={styles.row}>
        <Card
          color="primary"
          shape="hero"
          material={material}
          actionLabel="Open Lecture notes — Week 4"
          onClick={() => snack({ message: "Card opened" })}
          style={{ flex: "2 1 260px" }}
        >
          <div className={styles.heroText}>
            <span className={`pw-type-label-medium pw-type--emphasized ${styles.overline}`}>
              Continue reading
            </span>
            <span className="pw-type-headline-small pw-type--emphasized">
              Lecture notes — Week 4
            </span>
            <span className="pw-type-body-medium">Page 3 of 12 · edited 2 hours ago</span>
            <Button icon="edit" onClick={() => snack({ message: "Resume clicked" })}>
              Resume
            </Button>
          </div>
        </Card>
        <Card color="tertiary" shape="hero" material={material} style={{ flex: "1 1 160px" }}>
          <div className={styles.heroText}>
            <span className="pw-type-title-medium pw-type--emphasized">Pinned</span>
            <span className={styles.handwriting}>Exam formulas</span>
          </div>
        </Card>
      </div>
      <div className={styles.row}>
        <Card material={material} style={{ flex: 1 }}>
          Surface container
        </Card>
        <Card color="highest" material={material} style={{ flex: 1 }}>
          Highest
        </Card>
        <Card outlined material={material} style={{ flex: 1 }}>
          Outlined
        </Card>
      </div>
    </Section>
  );
}

export function ShowcaseList() {
  const [selected, setSelected] = useState("1");
  return (
    <Section title="List">
      <div className={styles.listBox}>
        <List label="Annotations">
          <ListItem
            headline="“energy, not matter”"
            supporting="Highlight · page 3"
            leading={<ListIcon icon="ink_highlighter" color="tertiary" />}
            trailing="2m"
            selected={selected === "1"}
            onClick={() => setSelected("1")}
          />
          <ListItem
            headline="Check this derivation"
            supporting="Comment · page 5"
            leading={<ListIcon icon="chat_bubble" color="primary" />}
            trailing="1h"
            selected={selected === "2"}
            onClick={() => setSelected("2")}
          />
          <ListItem
            headline="Arrow"
            leading={<ListIcon icon="arrow_outward" />}
            selected={selected === "3"}
            onClick={() => setSelected("3")}
          />
        </List>
      </div>
    </Section>
  );
}

export function ShowcaseTabs() {
  const [tab, setTab] = useState("all");
  return (
    <Tabs
      label="Example tabs"
      tabs={[
        { id: "all", label: "All", icon: "apps" },
        { id: "docs", label: "Documents", icon: "description" },
        { id: "pdf", label: "PDFs" },
      ]}
      value={tab}
      onChange={setTab}
    />
  );
}
