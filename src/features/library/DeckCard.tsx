import { useRef, useState } from "react";
import { useApp } from "../../appStore";
import { Card, COOKIE_PATH, Icon, IconButton, Menu } from "../../ui";
import { useThumb } from "../deck/thumbnail";
import { notify } from "../notices/notices";
import { slidesLabel, whenOpened } from "./greeting";
import type { LibraryDeck } from "./libraryFile";
import { matchSnippet } from "./librarySearch";
import styles from "./DeckCard.module.css";

/** The real first slide once it has been seen; a shape while loading or if a deck is broken. */
export function DeckThumb({ deck, className }: { deck: LibraryDeck; className?: string }) {
  const url = useThumb(deck.id, deck.thumb);
  return (
    <div className={`${styles.thumb} ${className ?? ""}`} aria-hidden="true">
      {url ? (
        <img src={url} alt="" className={styles.picture} />
      ) : (
        <svg viewBox="0 0 100 100" width="56" height="56">
          <path d={COOKIE_PATH} />
        </svg>
      )}
    </div>
  );
}

export function DeckMenu({ deck, onRemoved }: { deck: LibraryDeck; onRemoved?: () => void }) {
  const remove = useApp((s) => s.removeFromRecents);
  const toggleFavorite = useApp((s) => s.toggleFavorite);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <IconButton
        ref={setAnchor}
        icon="more_vert"
        label={`More options for ${deck.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      <Menu
        open={open}
        anchor={anchor}
        label={`Options for ${deck.title}`}
        material="glass"
        onClose={() => setOpen(false)}
        items={[
          {
            label: deck.favorite ? "Remove from favorites" : "Add to favorites",
            icon: "star",
            onSelect: () => {
              toggleFavorite(deck.id);
              // On the Favorites page this card disappears, and focus with it.
              onRemoved?.();
            },
          },
          {
            label: "Remove from recents",
            icon: "playlist_remove",
            onSelect: () => {
              remove(deck.id);
              onRemoved?.();
              notify("Removed from recents. The file wasn't touched.", "playlist_remove");
            },
          },
        ]}
      />
    </>
  );
}

export function DeckCard({
  deck,
  query = "",
  onRemoved,
}: {
  deck: LibraryDeck;
  query?: string;
  onRemoved: () => void;
}) {
  const openPath = useApp((s) => s.openPath);
  const meta = deck.missing
    ? "File not found"
    : (matchSnippet(deck, query) ??
      `${slidesLabel(deck.slides)} · ${whenOpened(deck.lastOpened, new Date())}`);
  return (
    <Card
      material="glass"
      actionLabel={`Open ${deck.title}${deck.missing ? ", file not found" : ""}`}
      onClick={() => void openPath(deck.path)}
      className={styles.deck}
    >
      <DeckThumb deck={deck} />
      <div className={styles.row}>
        <div className={styles.text}>
          <span className={styles.title}>
            {deck.favorite && <Icon name="star" filled size={16} className={styles.star} />}
            <span className={styles.titleText}>{deck.title}</span>
          </span>
          <span className={styles.meta}>{meta}</span>
        </div>
        <span className={styles.more}>
          <DeckMenu deck={deck} onRemoved={onRemoved} />
        </span>
      </div>
    </Card>
  );
}

export function NewDeckCard({ onClick }: { onClick: () => void }) {
  return (
    <Card material="glass" actionLabel="New presentation" onClick={onClick} className={styles.deck}>
      <div className={styles.newThumb} aria-hidden="true">
        <Icon name="add" size={28} />
        New presentation
      </div>
      <div className={styles.row}>
        <div className={styles.text}>
          <span className={styles.title}>Start from a layout</span>
          <span className={styles.meta}>Cover, two columns, quiz…</span>
        </div>
      </div>
    </Card>
  );
}

/** Cards share one place for the focus rule, so it can't be forgotten on one of the pages. */
export function DeckGrid({
  decks,
  query,
  children,
}: {
  decks: LibraryDeck[];
  query?: string;
  children?: React.ReactNode;
}) {
  const grid = useRef<HTMLDivElement>(null);
  // The card holding focus has just gone, so keyboard users would land back at the top of the page.
  const refocus = (index: number) => {
    requestAnimationFrame(() => {
      const more = grid.current?.querySelectorAll<HTMLElement>('[aria-haspopup="menu"]');
      const next = more?.[index] ?? more?.[index - 1];
      (next ?? document.getElementById(OPEN_BUTTON_ID))?.focus();
    });
  };
  return (
    <div ref={grid} className={styles.grid}>
      {decks.map((deck, index) => (
        <DeckCard key={deck.id} deck={deck} query={query} onRemoved={() => refocus(index)} />
      ))}
      {children}
    </div>
  );
}

export const OPEN_BUTTON_ID = "open-deck";
