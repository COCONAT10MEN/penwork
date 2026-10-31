import { useRef, useState } from "react";
import { useApp } from "../../appStore";
import {
  AmbientBackground,
  Button,
  IconButton,
  LoadingIndicator,
  LogoTile,
  NavigationRail,
  SearchBar,
  useSnackbar,
  type RailItem,
} from "../../ui";
import { pickDeck } from "../deck/useFileOpening";
import { Settings } from "../settings/Settings";
import { useSettings } from "../settings/settingsStore";
import { OPEN_BUTTON_ID } from "./DeckCard";
import { DecksPage } from "./DecksPage";
import { HomePage } from "./HomePage";
import { NewDeckDialog } from "./NewDeckDialog";
import { PasteDialog } from "./PasteDialog";
import styles from "./Home.module.css";

const NAV: RailItem[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "decks", label: "Decks", icon: "co_present" },
  { id: "layouts", label: "Layouts", icon: "grid_view" },
  { id: "favorites", label: "Favorites", icon: "star" },
];

export function Home({ dragging }: { dragging: boolean }) {
  const notify = useSnackbar();
  const opening = useApp((s) => s.opening);
  const openPath = useApp((s) => s.openPath);
  const logo = useSettings((s) => s.settings.logo);
  const [page, setPage] = useState("home");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<"paste" | "new" | null>(null);
  const main = useRef<HTMLElement>(null);

  const onOpen = async () => {
    const path = await pickDeck();
    if (path) await openPath(path, notify);
  };

  const go = (next: string) => {
    setPage(next);
    setQuery("");
    main.current?.scrollTo({ top: 0 });
  };

  const content = () => {
    if (query) return <DecksPage key="search" query={query} title="Search results" />;
    switch (page) {
      case "home":
        return (
          <HomePage
            dragging={dragging}
            onSeeAll={() => go("decks")}
            onNewDeck={() => setDialog("new")}
          />
        );
      case "decks":
        return <DecksPage key="decks" query="" title="Decks" />;
      case "favorites":
        return <DecksPage key="favorites" query="" title="Favorites" start="favorites" />;
      case "settings":
        return <Settings />;
      default:
        return (
          <>
            <h1 className={styles.pageTitle}>Layouts</h1>
            <p className={styles.sub}>The layout gallery arrives with editing.</p>
          </>
        );
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
            <span className={styles.logo}>
              <LogoTile size={52} svg={logo?.svg} label="Penwork" />
            </span>
          }
          footer={
            <IconButton
              icon="settings"
              label="Settings"
              tooltipPlacement="right"
              variant={page === "settings" ? "tonal" : "standard"}
              aria-current={page === "settings" ? "page" : undefined}
              onClick={() => go("settings")}
            />
          }
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
              label="Search decks and slides"
              value={query}
              onChange={setQuery}
            />
          </div>
          <span className={styles.spacer} />
          {opening && <LoadingIndicator label="Opening deck" size={40} />}
          <Button
            size="medium"
            variant="tonal"
            icon="content_paste"
            onClick={() => setDialog("paste")}
          >
            Paste from AI
          </Button>
          <Button
            id={OPEN_BUTTON_ID}
            size="medium"
            icon="folder_open"
            onClick={() => void onOpen()}
          >
            Open deck
          </Button>
        </div>
        {content()}
      </main>
      <PasteDialog open={dialog === "paste"} onClose={() => setDialog(null)} />
      <NewDeckDialog open={dialog === "new"} onClose={() => setDialog(null)} />
    </div>
  );
}
