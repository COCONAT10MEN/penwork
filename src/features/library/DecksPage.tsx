import { useState } from "react";
import { useApp } from "../../appStore";
import { Chip } from "../../ui";
import { DeckGrid } from "./DeckCard";
import { findDecks, type DeckFilter } from "./librarySearch";
import styles from "./Home.module.css";

const FILTERS: { id: DeckFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "favorites", label: "Favorites" },
  { id: "quizzes", label: "With quizzes" },
  { id: "interactive", label: "Interactive" },
];

/** Decks and Favorites are one page: Favorites just starts with that filter on. */
export function DecksPage({
  query,
  title,
  start = "all",
}: {
  query: string;
  title: string;
  start?: DeckFilter;
}) {
  const decks = useApp((s) => s.library.decks);
  const [filter, setFilter] = useState<DeckFilter>(start);
  const found = findDecks(decks, query, filter);
  const empty =
    decks.length === 0
      ? "No presentations yet. Open one to see it here."
      : query
        ? `Nothing found for “${query}”.`
        : "No presentations match this filter.";
  return (
    <>
      <h1 className={styles.pageTitle}>{title}</h1>
      <div className={styles.chips} role="group" aria-label="Filter presentations">
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
        <DeckGrid decks={found} query={query} />
      ) : (
        <p className={styles.sub}>{empty}</p>
      )}
    </>
  );
}
