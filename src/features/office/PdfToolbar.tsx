import { AnimatePresence, motion } from "motion/react";
import { Children, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { zoomLabel, type Fit } from "../../lib/pdfZoom";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { IconButton, Menu, RollingNumber } from "../../ui";
import { PdfMarkupTools } from "./PdfMarkupTools";
import { useToolArrival } from "./toolMotion";
import type { DocState, ToolId } from "./useReader";
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

/** One group of the bar's tools. The group arriving rises in, one tool after another. */
function Group({
  children,
  label,
  wrap = true,
}: {
  children: ReactNode;
  label: string;
  /** Off when the children arrive one by one themselves. */
  wrap?: boolean;
}) {
  const reduce = useReduceMotion();
  const fade = useSpring("effectsFast");
  const arrive = useToolArrival();
  return (
    <motion.div
      className={styles.pdfTools}
      role="group"
      aria-label={label}
      initial="out"
      animate="in"
      exit="gone"
      variants={{
        out: {},
        in: { transition: { staggerChildren: reduce ? 0 : 0.022 } },
        gone: { opacity: 0, y: reduce ? 0 : -10, transition: fade },
      }}
    >
      {wrap
        ? Children.toArray(children).map((child, i) => (
            <motion.span key={i} className={styles.toolSlot} variants={arrive}>
              {child}
            </motion.span>
          ))
        : children}
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
  markup,
  docState,
  onMarkup,
  onUse,
  onAct,
  onSet,
  onPage,
  onFit,
  onScale,
  onStep,
  onSidebar,
  onSearch,
}: {
  slot: HTMLElement;
  page: number;
  pages: number;
  scale: number;
  fit: Fit | null;
  sidebar: boolean;
  query: string;
  matches: { current: number; total: number } | null;
  /** Drawing: the bar shows the slide toolbar's tools instead of the reading ones. */
  markup: boolean;
  docState: DocState | null;
  onMarkup: () => void;
  onUse: (tool: ToolId | "ptr") => void;
  onAct: (action: "undo" | "redo" | "clear" | "hide") => void;
  onSet: (tool: ToolId, patch: Record<string, unknown>) => void;
  onPage: (page: number) => void;
  onFit: (fit: Fit) => void;
  onScale: (scale: number) => void;
  onStep: (steps: number) => void;
  onSidebar: () => void;
  onSearch: (query: string, backwards?: boolean, again?: boolean) => void;
}) {
  return createPortal(
    <div className={styles.pdfBarTools} role="toolbar" aria-label="PDF tools">
      <IconButton
        size="compact"
        icon={markup ? "check" : "draw"}
        label={markup ? "Done drawing" : "Draw on the PDF"}
        selected={markup}
        onClick={onMarkup}
      />
      <span className={styles.pdfDivider} />
      <AnimatePresence mode="popLayout" initial={false}>
        {markup && docState ? (
          <Group key="markup" label="Drawing tools" wrap={false}>
            <PdfMarkupTools state={docState} onUse={onUse} onAct={onAct} onSet={onSet} />
          </Group>
        ) : (
          <Group key="reading" label="Reading tools">
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
          </Group>
        )}
      </AnimatePresence>
    </div>,
    slot,
  );
}
