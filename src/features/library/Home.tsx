import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { useApp } from "../../appStore";
import { useReduceMotion, useSpring } from "../../theme/motion";
import {
  AmbientBackground,
  Button,
  FabMenu,
  LoadingIndicator,
  LogoTile,
  NavigationRail,
  PenworkMark,
  SearchBar,
  type RailItem,
} from "../../ui";
import { pickFile } from "../deck/useFileOpening";
import { Settings } from "../settings/Settings";
import { useSettings } from "../settings/settingsStore";
import { OPEN_BUTTON_ID } from "./FileCard";
import { FilesPage } from "./FilesPage";
import { HomePage } from "./HomePage";
import { NewDeckDialog } from "./NewDeckDialog";
import styles from "./Home.module.css";

const NAV: RailItem[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "files", label: "Files", icon: "folder" },
  { id: "favorites", label: "Favorites", icon: "star" },
];
const NAV_END: RailItem[] = [{ id: "settings", label: "Settings", icon: "settings" }];

export function Home({ dragging }: { dragging: boolean }) {
  const opening = useApp((s) => s.opening);
  const openPath = useApp((s) => s.openPath);
  const newOffice = useApp((s) => s.newOffice);
  const logo = useSettings((s) => s.settings.logo);
  const [page, setPage] = useState("home");
  const [query, setQuery] = useState("");
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const main = useRef<HTMLElement>(null);
  const glide = useSpring("spatialDefault");
  const fade = useSpring("effectsFast");
  const reduce = useReduceMotion();

  const onOpen = async () => {
    const path = await pickFile();
    if (path) await openPath(path);
  };

  const go = (next: string) => {
    setPage(next);
    setQuery("");
    main.current?.scrollTo({ top: 0 });
  };

  const content = () => {
    if (query) return <FilesPage key="search" title="Search results" query={query} />;
    switch (page) {
      case "home":
        return (
          <HomePage
            dragging={dragging}
            onSeeAll={() => go("files")}
            onNewDeck={() => setNewDeckOpen(true)}
          />
        );
      case "files":
        return <FilesPage key="files" title="Files" />;
      case "favorites":
        return <FilesPage key="favorites" title="Favorites" favorites />;
      default:
        return <Settings />;
    }
  };

  return (
    <div className={styles.home}>
      <AmbientBackground />
      <div className={styles.rail}>
        <NavigationRail
          label="Main"
          layout="stacked"
          material="glass"
          items={NAV}
          value={page}
          onChange={go}
          header={
            <>
              <span className={styles.logo}>
                {logo ? (
                  <LogoTile size={44} svg={logo.svg} label="Penwork" />
                ) : (
                  <PenworkMark label="Penwork" />
                )}
              </span>
              <span className={styles.create}>
                <FabMenu
                  label="Create"
                  placement="side"
                  items={[
                    {
                      label: "New presentation",
                      icon: "add",
                      onSelect: () => setNewDeckOpen(true),
                    },
                    {
                      label: "New document",
                      icon: "description",
                      onSelect: () => void newOffice("word"),
                    },
                    {
                      label: "New spreadsheet",
                      icon: "table_chart",
                      onSelect: () => void newOffice("sheet"),
                    },
                    { label: "Open a file", icon: "folder", onSelect: () => void onOpen() },
                  ]}
                />
              </span>
            </>
          }
          footerItems={NAV_END}
        />
      </div>
      <main
        ref={main}
        className={styles.main}
        data-dragging={(dragging && (page !== "home" || query !== "")) || undefined}
      >
        <div className={styles.top}>
          <div className={styles.search}>
            <SearchBar
              material="glass"
              label="Search all your files"
              value={query}
              onChange={setQuery}
            />
          </div>
          <span className={styles.spacer} />
          {opening && <LoadingIndicator label="Opening" size={40} />}
          <Button id={OPEN_BUTTON_ID} size="compact" icon="folder" onClick={() => void onOpen()}>
            Open
          </Button>
        </div>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={query ? "search" : page}
            className={styles.page}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0, transition: glide }}
            exit={{ opacity: 0, transition: fade }}
          >
            {content()}
          </motion.div>
        </AnimatePresence>
      </main>
      <NewDeckDialog open={newDeckOpen} onClose={() => setNewDeckOpen(false)} />
    </div>
  );
}
