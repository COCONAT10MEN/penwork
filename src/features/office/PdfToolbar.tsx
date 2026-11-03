import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { zoomLabel, type Fit } from "../../lib/pdfZoom";
import { useSpring } from "../../theme/motion";
import { ColorSwatches, IconButton, Menu, RollingNumber, Surface } from "../../ui";
import { cx } from "../../ui/cx";
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

const STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

/** Type a page number and press Enter. What's shown follows the page on screen otherwise. */
function PageBox({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const go = () => {
    const wanted = Number(draft);
    setDraft(null);
    if (Number.isInteger(wanted) && wanted >= 1 && wanted <= pages) onPage(wanted);
  };
  return (
    <span className={styles.pdfPage}>
      <span className={styles.pageField}>
        {draft === null && <RollingNumber value={String(page)} className={styles.pageShown} />}
        <input
          className={styles.pageInput}
          inputMode="numeric"
          aria-label={`Page, of ${pages}`}
          value={draft ?? String(page)}
          data-rolling={draft === null || undefined}
          onFocus={(e) => {
            setDraft(String(page));
            e.target.select();
          }}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onBlur={go}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
        />
      </span>
      <span className={styles.pageCount}>/ {pages}</span>
    </span>
  );
}

function ZoomControl({
  scale,
  fit,
  onFit,
  onScale,
  onStep,
}: {
  scale: number;
  fit: Fit | null;
  onFit: (fit: Fit) => void;
  onScale: (scale: number) => void;
  onStep: (steps: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <IconButton size="compact" icon="remove" label="Zoom out" onClick={() => onStep(-1)} />
      <button
        ref={setAnchor}
        type="button"
        className={cx("pw-state pw-press", styles.zoomButton)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Zoom, ${zoomLabel(scale)}`}
        onClick={() => setOpen((o) => !o)}
      >
        <RollingNumber value={zoomLabel(scale)} />
      </button>
      <IconButton size="compact" icon="add" label="Zoom in" onClick={() => onStep(1)} />
      <Menu
        open={open}
        anchor={anchor}
        label="Zoom"
        material="glass"
        onClose={() => setOpen(false)}
        items={[
          {
            label: "Fit width",
            icon: fit === "width" ? "check" : "fit_width",
            onSelect: () => onFit("width"),
          },
          {
            label: "Whole page",
            icon: fit === "page" ? "check" : "fit_page",
            onSelect: () => onFit("page"),
          },
          ...STEPS.map((step) => ({
            label: zoomLabel(step),
            icon: !fit && Math.abs(scale - step) < 0.005 ? "check" : "zoom_in",
            onSelect: () => onScale(step),
          })),
        ]}
      />
    </>
  );
}

export function PdfToolbar({
  slot,
  startColours,
  page,
  pages,
  scale,
  fit,
  sidebar,
  tool,
  query,
  matches,
  onPage,
  onFit,
  onScale,
  onStep,
  onSidebar,
  onTool,
  onColour,
  onSearch,
}: {
  slot: HTMLElement;
  startColours: { draw: string; highlight: string };
  page: number;
  pages: number;
  scale: number;
  fit: Fit | null;
  sidebar: boolean;
  tool: PdfTool;
  query: string;
  matches: { current: number; total: number } | null;
  onPage: (page: number) => void;
  onFit: (fit: Fit) => void;
  onScale: (scale: number) => void;
  onStep: (steps: number) => void;
  onSidebar: () => void;
  onTool: (tool: PdfTool) => void;
  onColour: (colour: string) => void;
  onSearch: (query: string, backwards?: boolean, again?: boolean) => void;
}) {
  const [picked, setPicked] = useState<Record<PdfTool, string>>({
    select: "",
    highlight: startColours.highlight,
    draw: startColours.draw,
    text: COLOURS.text[0] ?? "",
  });
  const glide = useSpring("spatialDefault");
  const fade = useSpring("effectsFast");
  return (
    <>
      <AnimatePresence>
        {tool !== "select" && (
          <motion.div
            key={tool}
            className={styles.pdfColours}
            initial={{ opacity: 0, y: -14, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: glide }}
            exit={{ opacity: 0, y: -8, transition: fade }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>
      {createPortal(
        <div className={styles.pdfTools} role="toolbar" aria-label="PDF tools">
          <IconButton
            size="compact"
            icon="side_navigation"
            label="Pages and contents"
            selected={sidebar}
            onClick={onSidebar}
          />
          <span className={styles.pdfDivider} />
          <IconButton
            size="compact"
            icon="keyboard_arrow_up"
            label="Previous page"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          />
          <PageBox page={page} pages={pages} onPage={onPage} />
          <IconButton
            size="compact"
            icon="keyboard_arrow_down"
            label="Next page"
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
          />
          <span className={styles.pdfDivider} />
          <ZoomControl scale={scale} fit={fit} onFit={onFit} onScale={onScale} onStep={onStep} />
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
              {matches && matches.total > 0 ? (
                <>
                  <RollingNumber value={String(matches.current)} /> of{" "}
                  <RollingNumber value={String(matches.total)} />
                </>
              ) : (
                "None"
              )}
            </span>
          )}
        </div>,
        slot,
      )}
    </>
  );
}
