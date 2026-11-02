import { useState } from "react";
import { useApp } from "../../appStore";
import { fileFolder, type OfficeKind } from "../../lib/office";
import { Chip, Icon, IconButton, List, ListItem, Surface } from "../../ui";
import { notify } from "../notices/notices";
import { whenOpened } from "./greeting";
import type { LibraryDocument } from "./libraryFile";
import styles from "./Home.module.css";

const FILTERS: { id: OfficeKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "word", label: "Word" },
  { id: "sheet", label: "Spreadsheets" },
  { id: "pdf", label: "PDF" },
];

const ICONS: Record<OfficeKind, string> = {
  word: "description",
  sheet: "table_chart",
  pdf: "picture_as_pdf",
};

function matches(document: LibraryDocument, filter: string, query: string): boolean {
  if (filter !== "all" && document.kind !== filter) return false;
  const name = document.name.toLocaleLowerCase();
  return query
    .toLocaleLowerCase()
    .split(/\s+/)
    .every((word) => name.includes(word));
}

/** Word, Excel and PDF files opened before, newest first. */
export function DocumentsPage({ query = "" }: { query?: string }) {
  const documents = useApp((s) => s.library.documents);
  const openPath = useApp((s) => s.openPath);
  const remove = useApp((s) => s.removeDocument);
  const [filter, setFilter] = useState<string>("all");
  const found = documents.filter((document) => matches(document, filter, query));
  return (
    <>
      <h1 className={styles.pageTitle}>Documents</h1>
      <div className={styles.chips} role="group" aria-label="Filter documents">
        {FILTERS.map(({ id, label }) => (
          <Chip
            key={id}
            variant="filter"
            label={label}
            selected={filter === id}
            onClick={() => setFilter(id)}
          />
        ))}
      </div>
      {found.length > 0 ? (
        <Surface material="glass" strength="thin" className={styles.documents}>
          <List label="Documents">
            {found.map((document) => (
              <ListItem
                key={document.id}
                headline={document.name}
                supporting={
                  document.missing
                    ? "File not found"
                    : `${whenOpened(document.lastOpened, new Date())} · ${fileFolder(document.path)}`
                }
                leading={<Icon name={ICONS[document.kind]} size={24} />}
                onClick={() => void openPath(document.path)}
                trailing={
                  <IconButton
                    size="compact"
                    icon="playlist_remove"
                    label={`Remove ${document.name} from recents`}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(document.id);
                      notify("Removed from recents. The file wasn't touched.", "playlist_remove");
                    }}
                  />
                }
              />
            ))}
          </List>
        </Surface>
      ) : (
        <p className={styles.sub}>
          {documents.length === 0
            ? "No documents yet. Open a Word, Excel or PDF file to see it here."
            : "Nothing matches."}
        </p>
      )}
    </>
  );
}
