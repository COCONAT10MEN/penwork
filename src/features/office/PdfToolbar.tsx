import { useState } from "react";
import { ColorSwatches, IconButton, Surface } from "../../ui";
import styles from "./OfficeView.module.css";

export type PdfTool = "select" | "highlight" | "draw" | "text";

const TOOLS: { id: PdfTool; label: string; icon: string }[] = [
  { id: "select", label: "Select text", icon: "text_select_start" },
  { id: "highlight", label: "Highlight", icon: "ink_highlighter" },
  { id: "draw", label: "Draw", icon: "draw" },
  { id: "text", label: "Add text", icon: "title" },
];

// What a user picks for ink on paper, so these stay the same in either theme.
const COLOURS: Record<PdfTool, string[]> = {
  select: [],
  highlight: ["#ffff98", "#53ffbc", "#80ebff", "#ffcbe6", "#ff4f5f"],
  draw: ["#1b1b1f", "#e5352b", "#1a73e8", "#188038", "#f9ab00"],
  text: ["#1b1b1f", "#e5352b", "#1a73e8", "#188038", "#f9ab00"],
};

export function PdfToolbar({
  page,
  pages,
  tool,
  query,
  matches,
  onPage,
  onZoom,
  onTool,
  onColour,
  onSearch,
}: {
  page: number;
  pages: number;
  tool: PdfTool;
  query: string;
  matches: { current: number; total: number } | null;
  onPage: (page: number) => void;
  onZoom: (way: "in" | "out" | "fit") => void;
  onTool: (tool: PdfTool) => void;
  onColour: (colour: string) => void;
  onSearch: (query: string, backwards?: boolean, again?: boolean) => void;
}) {
  const [picked, setPicked] = useState<Record<PdfTool, string>>({
    select: "",
    highlight: COLOURS.highlight[0] ?? "",
    draw: COLOURS.draw[0] ?? "",
    text: COLOURS.text[0] ?? "",
  });
  return (
    <div className={styles.pdfBars}>
      {tool !== "select" && (
        <Surface material="glass" floating className={styles.pdfBar}>
          <ColorSwatches
            label="Colour"
            colors={COLOURS[tool]}
            value={picked[tool]}
            onChange={(colour) => {
              setPicked({ ...picked, [tool]: colour });
              onColour(colour);
            }}
          />
        </Surface>
      )}
      <Surface
        material="glass"
        floating
        className={styles.pdfBar}
        role="toolbar"
        aria-label="PDF tools"
      >
        <IconButton
          size="compact"
          icon="keyboard_arrow_up"
          label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        />
        <span className={styles.pdfPage} aria-live="polite">
          {page} / {pages}
        </span>
        <IconButton
          size="compact"
          icon="keyboard_arrow_down"
          label="Next page"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        />
        <span className={styles.pdfDivider} />
        <IconButton size="compact" icon="remove" label="Zoom out" onClick={() => onZoom("out")} />
        <IconButton
          size="compact"
          icon="fit_width"
          label="Fit to width"
          onClick={() => onZoom("fit")}
        />
        <IconButton size="compact" icon="add" label="Zoom in" onClick={() => onZoom("in")} />
        <span className={styles.pdfDivider} />
        {TOOLS.map(({ id, label, icon }) => (
          <IconButton
            key={id}
            size="compact"
            icon={icon}
            label={label}
            selected={tool === id}
            onClick={() => onTool(id)}
          />
        ))}
        <span className={styles.pdfDivider} />
        <input
          className={styles.pdfFind}
          type="search"
          value={query}
          placeholder="Find"
          aria-label="Find in this PDF"
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch(query, e.shiftKey, true);
          }}
        />
        {query && (
          <span className={styles.pdfPage} aria-live="polite">
            {matches && matches.total > 0 ? `${matches.current} of ${matches.total}` : "None"}
          </span>
        )}
      </Surface>
    </div>
  );
}
