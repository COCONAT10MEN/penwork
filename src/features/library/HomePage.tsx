import { useApp } from "../../appStore";
import { Button, Card, CLOVER_PATH, Icon, Surface } from "../../ui";
import { cx } from "../../ui/cx";
import { DeckGrid, DeckMenu, DeckThumb, NewDeckCard, OPEN_BUTTON_ID } from "./DeckCard";
import { greeting, slidesLabel, whenOpened } from "./greeting";
import type { LibraryDeck } from "./libraryFile";
import styles from "./Home.module.css";

function DropZone({ dragging }: { dragging: boolean }) {
  return (
    <Surface
      material="glass"
      strength="thin"
      className={styles.drop}
      data-dragging={dragging || undefined}
    >
      <span className={styles.dropShape} aria-hidden="true">
        <svg viewBox="0 0 100 100" width="72" height="72">
          <path d={CLOVER_PATH} />
        </svg>
        <Icon name="download" size={32} className={styles.dropIcon} />
      </span>
      <span className={styles.dropTitle}>Drop a presentation here</span>
      <span className={styles.dropHint}>.pwpptx files open straight away</span>
    </Surface>
  );
}

function ContinueCard({ deck }: { deck: LibraryDeck }) {
  const openPath = useApp((s) => s.openPath);
  const tags = [
    slidesLabel(deck.slides),
    deck.quizzes > 0 && (deck.quizzes === 1 ? "1 quiz" : `${deck.quizzes} quizzes`),
    deck.interactive && "Interactive",
    deck.ink && "Ink saved",
  ].filter((tag) => typeof tag === "string");
  return (
    <Card material="glass" blur shape="hero" className={styles.continue}>
      <DeckThumb deck={deck} className={styles.continueThumb} />
      <div className={styles.continueText}>
        <span className={styles.continueMore}>
          <DeckMenu
            deck={deck}
            onRemoved={() =>
              requestAnimationFrame(() => document.getElementById(OPEN_BUTTON_ID)?.focus())
            }
          />
        </span>
        <span className={styles.overline}>Continue</span>
        <span className={styles.continueTitle}>{deck.title}</span>
        <span className={styles.meta}>
          {deck.missing
            ? "File not found"
            : `Slide ${deck.lastSlide + 1} of ${deck.slides} · ${whenOpened(deck.lastOpened, new Date())}`}
        </span>
        <div className={styles.tags}>
          {tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
        <div className={styles.continueActions}>
          <Button
            size="medium"
            icon="play_arrow"
            iconFilled
            className={styles.present}
            aria-label={`Present ${deck.title}`}
            onClick={() => void openPath(deck.path, { present: true })}
          >
            Present
          </Button>
          <Button
            size="medium"
            variant="quiet"
            icon="edit"
            className={styles.edit}
            aria-label={`Edit ${deck.title}`}
            onClick={() => void openPath(deck.path)}
          >
            Edit
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function HomePage({
  dragging,
  onSeeAll,
  onNewDeck,
}: {
  dragging: boolean;
  onSeeAll: () => void;
  onNewDeck: () => void;
}) {
  const decks = useApp((s) => s.library.decks);
  const [latest, ...others] = decks;
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.greeting}>{greeting(new Date().getHours())}</h1>
        <p className={styles.sub}>
          {latest
            ? "Ready to teach? Pick up where you left off."
            : "Open a presentation to get started."}
        </p>
      </header>
      <section className={styles.hero} aria-label="Start here">
        {latest && <ContinueCard deck={latest} />}
        <DropZone dragging={dragging} />
      </section>
      <section aria-labelledby="recent-heading">
        <div className={styles.headingRow}>
          <h2 id="recent-heading" className={styles.heading}>
            Recent presentations
          </h2>
          {others.length > 3 && (
            <button type="button" className={cx("pw-state", styles.seeAll)} onClick={onSeeAll}>
              See all
            </button>
          )}
        </div>
        <DeckGrid decks={others.slice(0, 3)}>
          <NewDeckCard onClick={onNewDeck} />
        </DeckGrid>
      </section>
    </>
  );
}
