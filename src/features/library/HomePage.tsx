import { useMemo, useState, type MouseEvent } from "react";
import { useApp } from "../../appStore";
import { Button, Card, Icon, Shape, Surface } from "../../ui";
import { cx } from "../../ui/cx";
import { FileCollection, FileMenu, FileThumb, KindMark, OPEN_BUTTON_ID } from "./FileCard";
import { greeting, slidesLabel, whenOpened } from "./greeting";
import { allFiles, KIND_NAMES, type FileKind, type LibraryFile } from "./libraryFiles";
import styles from "./Home.module.css";

function DropZone({ dragging }: { dragging: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <Surface
      material="glass"
      strength="thin"
      className={styles.drop}
      data-dragging={dragging || undefined}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <Shape
        name={dragging ? "Burst" : hover ? "Flower" : "Clover4Leaf"}
        size={dragging ? 88 : 76}
        className={styles.dropShape}
      >
        <Icon name="download" size={32} />
      </Shape>
      <span className={styles.dropTitle}>Drop a file here</span>
      <span className={styles.dropHint}>Presentations, Word, Excel and PDF files</span>
    </Surface>
  );
}

function fileTags(file: LibraryFile): string[] {
  const { deck } = file;
  if (!deck) return [KIND_NAMES[file.kind]];
  return [
    slidesLabel(deck.slides),
    deck.quizzes > 0 && (deck.quizzes === 1 ? "1 quiz" : `${deck.quizzes} quizzes`),
    deck.interactive && "Interactive",
    deck.ink && "Ink saved",
  ].filter((tag) => typeof tag === "string");
}

function continueMeta(file: LibraryFile): string {
  if (file.missing) return "File not found";
  const when = whenOpened(file.lastOpened, new Date());
  return file.deck ? `Slide ${file.deck.lastSlide + 1} of ${file.deck.slides} · ${when}` : when;
}

function ContinueCard({ file }: { file: LibraryFile }) {
  const openPath = useApp((s) => s.openPath);
  const startLaunch = useApp((s) => s.startLaunch);
  const startShow = (e: MouseEvent<HTMLElement>) => {
    const thumb = e.currentTarget.closest("section")?.querySelector<HTMLElement>("[data-thumb]");
    if (thumb) {
      const { left, top, width, height } = thumb.getBoundingClientRect();
      const picture = thumb.querySelector("img")?.src ?? null;
      startLaunch({ url: picture, rect: { left, top, width, height } });
    }
    void openPath(file.path, { present: true });
  };
  return (
    <Card material="glass" blur shape="hero" className={styles.continue}>
      <Shape name="Sunny" size={420} spin className={styles.heroShape} />
      <FileThumb file={file} className={styles.continueThumb} />
      <div className={styles.continueText}>
        <span className={styles.continueMore}>
          <FileMenu
            file={file}
            onRemoved={() =>
              requestAnimationFrame(() => document.getElementById(OPEN_BUTTON_ID)?.focus())
            }
          />
        </span>
        <span className={styles.overline}>Continue</span>
        <span className={styles.continueTitle}>{file.title}</span>
        <span className={styles.meta}>{continueMeta(file)}</span>
        <div className={styles.tags}>
          {fileTags(file).map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
        <div className={styles.continueActions} data-press-group>
          {file.deck ? (
            <>
              <Button
                size="medium"
                icon="play_arrow"
                iconFilled
                className={styles.present}
                aria-label={`Present ${file.title}`}
                onClick={startShow}
              >
                Present
              </Button>
              <Button
                size="medium"
                variant="quiet"
                icon="edit"
                className={styles.edit}
                aria-label={`Edit ${file.title}`}
                onClick={() => void openPath(file.path)}
              >
                Edit
              </Button>
            </>
          ) : (
            <Button
              size="medium"
              icon="open_in_new"
              className={styles.present}
              aria-label={`Open ${file.title}`}
              onClick={() => void openPath(file.path)}
            >
              Open
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function NewCard({ kind, label, onClick }: { kind: FileKind; label: string; onClick: () => void }) {
  return (
    <button type="button" className={cx("pw-state pw-press", styles.newCard)} onClick={onClick}>
      <KindMark kind={kind} size={40} />
      {label}
    </button>
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
  const library = useApp((s) => s.library);
  const newOffice = useApp((s) => s.newOffice);
  const [latest, ...others] = useMemo(() => allFiles(library), [library]);
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.greeting}>{greeting(new Date().getHours())}</h1>
        <p className={styles.sub}>
          {latest ? "Pick up where you left off." : "Open a file or start something new."}
        </p>
      </header>
      <section className={styles.hero} aria-label="Start here">
        {latest && <ContinueCard file={latest} />}
        <DropZone dragging={dragging} />
      </section>
      <section className={styles.new} aria-label="Start something new">
        <NewCard kind="deck" label="New presentation" onClick={onNewDeck} />
        <NewCard kind="word" label="New document" onClick={() => void newOffice("word")} />
        <NewCard kind="sheet" label="New spreadsheet" onClick={() => void newOffice("sheet")} />
      </section>
      {others.length > 0 && (
        <section aria-labelledby="recent-heading">
          <div className={styles.headingRow}>
            <h2 id="recent-heading" className={styles.heading}>
              Recent files
            </h2>
            {others.length > 4 && (
              <button type="button" className={cx("pw-state", styles.seeAll)} onClick={onSeeAll}>
                See all
              </button>
            )}
          </div>
          <FileCollection files={others.slice(0, 4)} />
        </section>
      )}
    </>
  );
}
