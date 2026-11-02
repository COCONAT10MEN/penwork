import { invoke } from "@tauri-apps/api/core";
import { useRef, useState, type ReactNode } from "react";
import { useApp } from "../../appStore";
import { Card, Icon, IconButton, Menu, Shape, type ShapeName } from "../../ui";
import { cx } from "../../ui/cx";
import { useThumb } from "../deck/thumbnail";
import { notify, showError } from "../notices/notices";
import { fileDetail } from "./fileDetail";
import { KIND_ICONS, type FileKind, type LibraryFile } from "./libraryFiles";
import styles from "./FileCard.module.css";

const KIND_SHAPES: Record<FileKind, ShapeName> = {
  deck: "Cookie9Sided",
  word: "Clover4Leaf",
  sheet: "Cookie4Sided",
  pdf: "Sunny",
};

/** The type of a file at a glance: its own shape, colour and icon. */
export function KindMark({ kind, size = 40 }: { kind: FileKind; size?: number }) {
  return (
    <span className={styles.mark} data-kind={kind} style={{ width: size, height: size }}>
      <Shape name={KIND_SHAPES[kind]} size={size} solid color="var(--pw-kind)">
        <Icon name={KIND_ICONS[kind]} size={Math.round(size * 0.52)} filled />
      </Shape>
    </span>
  );
}

/** The real first page once it has been seen, and the type's mark until then. */
export function FileThumb({ file, className }: { file: LibraryFile; className?: string }) {
  const url = useThumb(file.id, file.thumb);
  return (
    <div
      className={cx(styles.thumb, className)}
      data-kind={file.kind}
      aria-hidden="true"
      data-thumb
    >
      {url ? (
        <img src={url} alt="" className={styles.picture} />
      ) : file.thumb ? null : (
        // Only when there's no picture yet: one still loading must not flash this first.
        <KindMark kind={file.kind} size={64} />
      )}
    </div>
  );
}

export function FileMenu({ file, onRemoved }: { file: LibraryFile; onRemoved?: () => void }) {
  const remove = useApp((s) => s.removeFromRecents);
  const toggleFavorite = useApp((s) => s.toggleFavorite);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <IconButton
        ref={setAnchor}
        icon="more_vert"
        label={`More options for ${file.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      />
      <Menu
        open={open}
        anchor={anchor}
        label={`Options for ${file.title}`}
        material="glass"
        onClose={() => setOpen(false)}
        items={[
          {
            label: file.favorite ? "Remove from favorites" : "Add to favorites",
            icon: "star",
            onSelect: () => {
              toggleFavorite(file.id);
              // On the Favorites page this card disappears, and focus with it.
              onRemoved?.();
            },
          },
          {
            label: "Show in folder",
            icon: "folder_open",
            onSelect: () => {
              invoke("show_in_folder", { path: file.path }).catch(() =>
                showError("This file isn't there any more. It may have been moved or renamed."),
              );
            },
          },
          {
            label: "Remove from recents",
            icon: "playlist_remove",
            onSelect: () => {
              remove(file.id);
              onRemoved?.();
              notify("Removed from recents. The file wasn't touched.", "playlist_remove");
            },
          },
        ]}
      />
    </>
  );
}

function FileCard({
  file,
  query,
  onRemoved,
}: {
  file: LibraryFile;
  query: string;
  onRemoved: () => void;
}) {
  const openPath = useApp((s) => s.openPath);
  return (
    <Card
      material="glass"
      actionLabel={`Open ${file.title}${file.missing ? ", file not found" : ""}`}
      onClick={() => void openPath(file.path)}
      className={styles.card}
    >
      <FileThumb file={file} />
      <div className={styles.row}>
        <KindMark kind={file.kind} size={32} />
        <div className={styles.text}>
          <span className={styles.title}>
            {file.favorite && <Icon name="star" filled size={16} className={styles.star} />}
            <span className={styles.titleText}>{file.title}</span>
          </span>
          <span className={styles.meta}>{fileDetail(file, query)}</span>
        </div>
        <span className={styles.more}>
          <FileMenu file={file} onRemoved={onRemoved} />
        </span>
      </div>
    </Card>
  );
}

function FileRow({
  file,
  query,
  onRemoved,
}: {
  file: LibraryFile;
  query: string;
  onRemoved: () => void;
}) {
  const openPath = useApp((s) => s.openPath);
  return (
    <div className={styles.listRow}>
      <button
        type="button"
        className={cx("pw-state", styles.rowButton)}
        aria-label={`Open ${file.title}${file.missing ? ", file not found" : ""}`}
        onClick={() => void openPath(file.path)}
      >
        <KindMark kind={file.kind} size={40} />
        <span className={styles.text}>
          <span className={styles.title}>
            {file.favorite && <Icon name="star" filled size={16} className={styles.star} />}
            <span className={styles.titleText}>{file.title}</span>
          </span>
          <span className={styles.meta}>{fileDetail(file, query)}</span>
        </span>
        <span className={styles.folder}>{file.path}</span>
      </button>
      <FileMenu file={file} onRemoved={onRemoved} />
    </div>
  );
}

/** Cards share one place for the focus rule, so it can't be forgotten on one of the pages. */
export function FileCollection({
  files,
  query = "",
  view = "grid",
  children,
}: {
  files: LibraryFile[];
  query?: string;
  view?: "grid" | "list";
  children?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  // The card holding focus has just gone, so keyboard users would land back at the top of the page.
  const refocus = (index: number) => {
    requestAnimationFrame(() => {
      const more = box.current?.querySelectorAll<HTMLElement>('[aria-haspopup="menu"]');
      const next = more?.[index] ?? more?.[index - 1];
      (next ?? document.getElementById(OPEN_BUTTON_ID))?.focus();
    });
  };
  const Item = view === "grid" ? FileCard : FileRow;
  return (
    <div ref={box} className={view === "grid" ? styles.grid : styles.list}>
      {files.map((file, index) => (
        <Item key={file.id} file={file} query={query} onRemoved={() => refocus(index)} />
      ))}
      {children}
    </div>
  );
}

export const OPEN_BUTTON_ID = "open-file";
