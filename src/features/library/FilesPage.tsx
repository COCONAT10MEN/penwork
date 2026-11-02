import { useMemo, useState } from "react";
import { useApp } from "../../appStore";
import { ButtonGroup, Tabs, type TabItem } from "../../ui";
import { useSettings } from "../settings/settingsStore";
import { FileCollection } from "./FileCard";
import {
  allFiles,
  countByKind,
  findFiles,
  KIND_ICONS,
  type FileFilter,
  type FileSort,
} from "./libraryFiles";
import styles from "./Home.module.css";

const FILTERS: (TabItem & { id: FileFilter })[] = [
  { id: "all", label: "All", icon: "apps" },
  { id: "deck", label: "Presentations", icon: KIND_ICONS.deck },
  { id: "word", label: "Documents", icon: KIND_ICONS.word },
  { id: "sheet", label: "Spreadsheets", icon: KIND_ICONS.sheet },
  { id: "pdf", label: "PDFs", icon: KIND_ICONS.pdf },
];

const SORTS = [
  { value: "recent", label: "Recent" },
  { value: "name", label: "Name" },
  { value: "type", label: "Type" },
];

const VIEWS = [
  { value: "grid", ariaLabel: "Show as cards", icon: "grid_view" },
  { value: "list", ariaLabel: "Show as a list", icon: "view_list" },
];

/** Files and Favorites are one page: Favorites just keeps to the starred ones. */
export function FilesPage({
  title,
  query = "",
  favorites = false,
}: {
  title: string;
  query?: string;
  favorites?: boolean;
}) {
  const library = useApp((s) => s.library);
  const filesView = useSettings((s) => s.settings.filesView);
  const filesSort = useSettings((s) => s.settings.filesSort);
  const update = useSettings((s) => s.update);
  const [filter, setFilter] = useState<FileFilter>("all");

  const files = useMemo(() => allFiles(library), [library]);
  const inScope = useMemo(() => findFiles(files, { query, favorites }), [files, query, favorites]);
  const found = findFiles(inScope, { filter, sort: filesSort });
  const counts = countByKind(inScope);

  const empty = () => {
    if (query) return `Nothing found for “${query}”.`;
    if (favorites && counts.all === 0) return "Star a file to keep it here.";
    if (files.length === 0) return "No files yet. Open one to see it here.";
    return "Nothing of this type yet.";
  };

  return (
    <>
      <h1 className={styles.pageTitle}>{title}</h1>
      <div className={styles.fileBar}>
        <Tabs
          label="Type of file"
          tabs={FILTERS}
          value={filter}
          onChange={(id) => setFilter(id as FileFilter)}
        />
        <span className={styles.spacer} />
        <ButtonGroup
          label="Sort by"
          options={SORTS}
          value={filesSort}
          onChange={(value) => update({ filesSort: value as FileSort })}
        />
        <ButtonGroup
          label="View"
          options={VIEWS}
          value={filesView}
          onChange={(value) => update({ filesView: value as "grid" | "list" })}
        />
      </div>
      {found.length > 0 ? (
        <FileCollection key={filter} files={found} query={query} view={filesView} />
      ) : (
        <p className={styles.sub}>{empty()}</p>
      )}
    </>
  );
}
