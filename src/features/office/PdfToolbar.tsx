import { motion } from "motion/react";
import { Children, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { zoomLabel, type Fit } from "../../lib/pdfZoom";
import { useReduceMotion } from "../../theme/motion";
import { Icon, IconButton, Menu, RollingNumber } from "../../ui";
import { useToolArrival } from "./toolMotion";
import { cx } from "../../ui/cx";
import styles from "./OfficeView.module.css";

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

/**
 * The bar's tools, rising in one after another when the PDF opens. The annotation tools at the
 * start arrive first, so these wait for them and carry the same wave on.
 */
function Group({ children, label }: { children: ReactNode; label: string }) {
  const reduce = useReduceMotion();
  const arrive = useToolArrival();
  return (
    <motion.div
      className={styles.pdfTools}
      role="group"
      aria-label={label}
      initial="out"
      animate="in"
      variants={{
        out: {},
        in: {
          transition: { delayChildren: reduce ? 0 : 0.34, staggerChildren: reduce ? 0 : 0.03 },
        },
      }}
    >
      {Children.toArray(children).map((child, i) => (
        <motion.span key={i} className={styles.toolSlot} variants={arrive}>
          {child}
        </motion.span>
      ))}
    </motion.div>
  );
}

export function PdfToolbar({
  slot,
  page,
  pages,
  scale,
  fit,
  sidebar,
  query,
  matches,
  onPage,
  onFit,
  onScale,
  onStep,
  onSidebar,
  onSearch,
  inkOff,
  moreOpen,
  onMore,
}: {
  slot: HTMLElement;
  page: number;
  pages: number;
  scale: number;
  fit: Fit | null;
  sidebar: boolean;
  query: string;
  matches: { current: number; total: number } | null;
  onPage: (page: number) => void;
  onFit: (fit: Fit) => void;
  onScale: (scale: number) => void;
  onStep: (steps: number) => void;
  onSidebar: () => void;
  onSearch: (query: string, backwards?: boolean, again?: boolean) => void;
  /** The annotation tools are switched off: the divider beside their place folds away too. */
  inkOff: boolean;
  /** The ⋮ sheet with every PDF tool. */
  moreOpen: boolean;
  onMore: () => void;
}) {
  return createPortal(
    <div
      className={styles.pdfBarTools}
      role="toolbar"
      aria-label="PDF tools"
      data-ink-off={inkOff || undefined}
    >
      <Group label="Reading tools">
        {/* The presentation's annotation tools sit here, always out. The reader page under the bar
            draws them, and this keeps room for them as wide as they are. */}
        <span className={styles.dockSeat} data-dock-seat />
        <span className={styles.pdfDivider} />
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
        <span className={styles.findBox}>
          <Icon name="search" size={20} className={styles.findIcon} />
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
        </span>
        {query ? (
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
        ) : null}
        <IconButton
          size="compact"
          icon="more_vert"
          label="PDF tools"
          selected={moreOpen}
          onClick={onMore}
        />
      </Group>
    </div>,
    slot,
  );
}
