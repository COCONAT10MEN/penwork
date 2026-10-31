import { useRef, useState } from "react";
import { useApp } from "../../appStore";
import {
  AmbientBackground,
  Button,
  Card,
  Icon,
  IconButton,
  LoadingIndicator,
  Menu,
  NavigationRail,
  PenworkLogo,
  SearchBar,
  useSnackbar,
  type RailItem,
} from "../../ui";
import { COOKIE_PATH } from "../../ui/shapes";
import { pickDeck } from "../deck/useFileOpening";
import { greeting, whenOpened } from "./greeting";
import type { LibraryDeck } from "./libraryFile";
import styles from "./Home.module.css";

const NAV: RailItem[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "decks", label: "Decks", icon: "co_present" },
  { id: "layouts", label: "Layouts", icon: "grid_view" },
  { id: "favorites", label: "Favorites", icon: "star" },
];

function DeckCard({ deck, onRemoved }: { deck: LibraryDeck; onRemoved: () => void }) {
  const notify = useSnackbar();
  const openPath = useApp((s) => s.openPath);
  const remove = useApp((s) => s.removeFromRecents);
  const [menu, setMenu] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <Card
      material="glass"
      actionLabel={`Open ${deck.title}`}
      onClick={() => void openPath(deck.path, notify)}
      className={styles.deck}
    >
      <div className={styles.thumb} aria-hidden="true">
        <svg viewBox="0 0 100 100" width="56" height="56">
          <path d={COOKIE_PATH} />
        </svg>
      </div>
      <div className={styles.deckRow}>
        <div className={styles.deckText}>
          <span className={styles.deckTitle}>{deck.title}</span>
          <span className={styles.deckMeta}>
            {deck.missing
              ? "File not found"
              : `${deck.slides} slides · ${whenOpened(deck.lastOpened, new Date())}`}
          </span>
        </div>
        <IconButton
          ref={setAnchor}
          icon="more_vert"
          label={`More options for ${deck.title}`}
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu((o) => !o)}
        />
        <Menu
          open={menu}
          anchor={anchor}
          label={`Options for ${deck.title}`}
          material="glass"
          onClose={() => setMenu(false)}
          items={[
            {
              label: "Remove from recents",
              icon: "playlist_remove",
              onSelect: () => {
                remove(deck.id);
                onRemoved();
                notify({
                  message: "Removed from recents. The file wasn't touched.",
                  material: "glass",
                });
              },
            },
          ]}
        />
      </div>
    </Card>
  );
}

function DropZone({ dragging }: { dragging: boolean }) {
  return (
    <div className={styles.drop} data-dragging={dragging || undefined}>
      <Icon name="download" size={32} className={styles.dropIcon} />
      <span className={styles.dropTitle}>Drop a deck here</span>
      <span className={styles.dropHint}>.pwpptx files open straight away</span>
    </div>
  );
}

function ContinueCard({ deck }: { deck: LibraryDeck }) {
  const notify = useSnackbar();
  const openPath = useApp((s) => s.openPath);
  return (
    <Card
      material="glass"
      blur
      shape="hero"
      actionLabel={`Continue ${deck.title}`}
      onClick={() => void openPath(deck.path, notify)}
      className={styles.continue}
    >
      <span className={styles.overline}>Continue</span>
      <span className={styles.continueTitle}>{deck.title}</span>
      <span className={styles.deckMeta}>
        Slide {deck.lastSlide + 1} of {deck.slides} · {whenOpened(deck.lastOpened, new Date())}
      </span>
      <Button size="medium" icon="play_arrow" onClick={() => void openPath(deck.path, notify)}>
        Open
      </Button>
    </Card>
  );
}

export function Home({ dragging }: { dragging: boolean }) {
  const notify = useSnackbar();
  const decks = useApp((s) => s.library.decks);
  const opening = useApp((s) => s.opening);
  const openPath = useApp((s) => s.openPath);
  const [page, setPage] = useState("home");
  const [query, setQuery] = useState("");
  const latest = decks[0];
  const grid = useRef<HTMLDivElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);

  const onOpen = async () => {
    const path = await pickDeck();
    if (path) await openPath(path, notify);
  };

  // The card holding focus has just gone, so keyboard users would land back at the top of the page.
  const refocusAfterRemove = (index: number) => {
    requestAnimationFrame(() => {
      const more = grid.current?.querySelectorAll<HTMLElement>('[aria-haspopup="menu"]');
      const next = more?.[index] ?? more?.[index - 1] ?? openButton.current;
      next?.focus();
    });
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
          onChange={setPage}
          header={
            <span className={styles.logo}>
              <PenworkLogo size={44} label="Penwork" />
            </span>
          }
          footer={<IconButton icon="settings" label="Settings" tooltipPlacement="right" />}
        />
      </div>
      <main className={styles.main}>
        <div className={styles.top}>
          <div className={styles.search}>
            <SearchBar
              material="glass"
              label="Search decks and slides"
              value={query}
              onChange={setQuery}
            />
          </div>
          {opening && <LoadingIndicator label="Opening deck" size={40} />}
          <Button
            ref={openButton}
            size="medium"
            icon="folder_open"
            onClick={() => void onOpen()}
          >
            Open deck
          </Button>
        </div>

        {page === "home" ? (
          <>
            <header className={styles.header}>
              <h1 className={styles.greeting}>{greeting(new Date().getHours())}</h1>
              <p className={styles.sub}>
                {latest
                  ? "Ready to teach? Pick up where you left off."
                  : "Open a deck to get started."}
              </p>
            </header>
            <section className={styles.hero} aria-label="Start here">
              {latest && <ContinueCard deck={latest} />}
              <DropZone dragging={dragging} />
            </section>
            {decks.length > 0 && (
              <section aria-label="Recent decks">
                <h2 className={styles.heading}>Recent decks</h2>
                <div ref={grid} className={styles.grid}>
                  {decks.map((deck, index) => (
                    <DeckCard
                      key={deck.id}
                      deck={deck}
                      onRemoved={() => refocusAfterRemove(index)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <p className={styles.sub}>This page arrives in the next update.</p>
        )}
      </main>
    </div>
  );
}
