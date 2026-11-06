import { useEffect, useRef } from "react";
import { Chip, Icon, IconButton, SearchBar } from "../../ui";
import type { SettingRow } from "./searchSettings";
import type { Tool } from "./types";
import { MAX_HITS, type Hit, type PdfSearch } from "./usePdfSearch";
import styles from "./PdfTools.module.css";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The field and its options: they stay put while the results scroll under them. */
export function SearchHead({ search, focus }: { search: PdfSearch; focus: number }) {
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, [focus]);
  useEffect(() => {
    const input = field.current;
    // Enter for the next match, Shift+Enter for the one before, as in Office and Acrobat.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      search.step(e.shiftKey);
    };
    input?.addEventListener("keydown", onKey);
    return () => input?.removeEventListener("keydown", onKey);
  }, [search]);

  const { total, read, current, query } = search;
  const searching = !!query.trim() && read[0] < read[1];
  const count = !query.trim()
    ? ""
    : total
      ? current
        ? `${search.hits.findIndex((h) => h.page === current.page && h.index === current.index) + 1 || "–"} of ${total}`
        : plural(total, "result", "results")
      : searching
        ? "Searching…"
        : "No results";

  return (
    <div className={styles.searchHead}>
      <SearchBar
        ref={field}
        label="Search"
        placeholder="Search text, tools and settings"
        value={query}
        onChange={search.setQuery}
        material="tonal"
      />
      <div className={styles.searchBar}>
        <Chip
          variant="filter"
          label="Match case"
          selected={search.options.caseSensitive}
          onClick={() =>
            search.setOptions({ ...search.options, caseSensitive: !search.options.caseSensitive })
          }
        />
        <Chip
          variant="filter"
          label="Whole words"
          selected={search.options.entireWord}
          onClick={() =>
            search.setOptions({ ...search.options, entireWord: !search.options.entireWord })
          }
        />
        <span className={styles.searchCount} aria-live="polite">
          {count}
        </span>
        <IconButton
          size="compact"
          icon="keyboard_arrow_up"
          label="Previous result"
          disabled={!total}
          onClick={() => search.step(true)}
        />
        <IconButton
          size="compact"
          icon="keyboard_arrow_down"
          label="Next result"
          disabled={!total}
          onClick={() => search.step(false)}
        />
      </div>
    </div>
  );
}

/** Tools and settings that match first, briefly; then every match in the text, by page. */
export function SearchResults({
  search,
  tools,
  settings,
  onTool,
  onSetting,
}: {
  search: PdfSearch;
  tools: Tool[];
  settings: SettingRow[];
  onTool: (tool: Tool) => void;
  onSetting: (row: SettingRow) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const { hits, current, total } = search;

  // The current match stays in sight in the list as Enter steps through them.
  useEffect(() => {
    if (!current) return;
    list.current
      ?.querySelector(`[data-hit="${current.page}-${current.index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [current]);

  if (!search.query.trim()) return null;
  const pages: Hit[][] = [];
  for (const hit of hits) {
    const last = pages[pages.length - 1];
    if (last && last[0]?.page === hit.page) last.push(hit);
    else pages.push([hit]);
  }

  return (
    <div className={styles.results} ref={list}>
      {(tools.length > 0 || settings.length > 0) && (
        <section className={styles.resultGroup} aria-label="Tools and settings">
          {tools.slice(0, 6).map((t) => (
            <button
              key={t.id}
              type="button"
              className={`pw-state ${styles.resultRow}`}
              onClick={() => onTool(t)}
            >
              <Icon name={t.icon} size={20} className={styles.resultIcon} />
              <span className={styles.resultName}>{t.title}</span>
              <span className={styles.resultWhere}>Tool</span>
            </button>
          ))}
          {settings.map((s) => (
            <button
              key={s.label}
              type="button"
              className={`pw-state ${styles.resultRow}`}
              onClick={() => onSetting(s)}
            >
              <Icon name="settings" size={20} className={styles.resultIcon} />
              <span className={styles.resultName}>{s.label}</span>
              <span className={styles.resultWhere}>Settings</span>
            </button>
          ))}
        </section>
      )}
      {pages.map((group) => (
        <section key={group[0]?.page} className={styles.resultGroup}>
          <h3 className={styles.resultPage}>
            Page {group[0]?.page}
            <span>{group.length}</span>
          </h3>
          {group.map((hit) => {
            const on = current?.page === hit.page && current.index === hit.index;
            return (
              <button
                key={hit.index}
                type="button"
                data-hit={`${hit.page}-${hit.index}`}
                aria-current={on || undefined}
                className={`pw-state ${styles.hitRow}`}
                onClick={() => search.go(hit)}
              >
                {hit.before}
                <mark>{hit.match}</mark>
                {hit.after}
              </button>
            );
          })}
        </section>
      ))}
      {total > MAX_HITS && (
        <p className={styles.note}>
          The first {MAX_HITS} of {total}. Enter steps through all of them.
        </p>
      )}
    </div>
  );
}
