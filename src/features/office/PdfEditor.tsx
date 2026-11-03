import type { PDFDocumentProxy } from "pdfjs-dist";
import type { EventBus, PDFFindController, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useEffect, useRef, useState } from "react";
import type { Fit } from "../../lib/pdfZoom";
import { LoadingIndicator } from "../../ui";
import { useSettings } from "../settings/settingsStore";
import { showError } from "../notices/notices";
import type { OfficeEditorProps } from "./officeFile";
import { PdfSidebar } from "./PdfSidebar";
import { PdfToolbar, type PdfTool } from "./PdfToolbar";
import { loadPdf, PDF_ASSETS } from "./pdfLoader";
import { useBarHiding } from "./useBarHiding";
import { setEditorMode, setPage as showPage } from "./pdfViewerSet";
import { usePdfZoom } from "./usePdfZoom";
import styles from "./OfficeView.module.css";

/** Numbers from pdf.js's AnnotationEditorType. */
const MODES: Record<PdfTool, number> = { select: 0, text: 3, highlight: 9, draw: 15 };
// What pdf.js paints a page with, so these are data for it and not app colours.
const DARK_PAGE = { background: "#1b1b1f", foreground: "#e4e2e6" };
const HIGHLIGHT_COLORS = "yellow=#FFFF98,green=#53FFBC,blue=#80EBFF,pink=#FFCBE6,red=#FF4F5F";
// Each page's picture tops out here and zooming further draws only what's on screen. Lower than
// pdf.js's own, because the laptop this is for has 8 GB shared with the graphics.
const MAX_CANVAS_PIXELS = 2 ** 24;

interface Loaded {
  viewer: PDFViewer;
  bus: EventBus;
  find: PDFFindController;
  document: PDFDocumentProxy;
}

export default function PdfEditor({
  file,
  handleRef,
  toolsSlot,
  onChange,
  onBarHidden,
}: OfficeEditorProps) {
  const { bytes } = file;
  const settings = useSettings((s) => s.settings);
  const { darkPages, pdfZoom, pdfTwoPages, pdfPen, pdfHighlight, pdfPenSize, pdfHideBar } =
    settings;
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [parts, setParts] = useState<Loaded | null>(null);
  const [page, setPage] = useState(1);
  const [sidebar, setSidebar] = useState(false);
  const [tool, setTool] = useState<PdfTool>("select");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<{ current: number; total: number } | null>(null);
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  });

  const [startFit] = useState<Fit | null>(() =>
    pdfZoom === "page-fit" ? "page" : pdfZoom === "100" ? null : "width",
  );
  const zoom = usePdfZoom(box, parts, { fit: startFit, scale: 1, across: pdfTwoPages ? 2 : 1 });
  const barHidden = useBarHiding(box, pdfHideBar, onBarHidden);

  useEffect(() => {
    if (!bytes || !box) return;
    const quit = new AbortController();
    let opened: { destroy: () => Promise<void> } | null = null;

    void (async () => {
      const { pdfjs, viewer: kit } = await loadPdf();
      if (quit.signal.aborted) return;
      const bus = new kit.EventBus();
      const links = new kit.PDFLinkService({ eventBus: bus });
      const find = new kit.PDFFindController({ eventBus: bus, linkService: links });
      const options = {
        container: box,
        eventBus: bus,
        linkService: links,
        findController: find,
        removePageBorders: true,
        maxCanvasPixels: MAX_CANVAS_PIXELS,
        annotationEditorMode: MODES.select,
        annotationEditorHighlightColors: HIGHLIGHT_COLORS,
        abortSignal: quit.signal,
        ...(darkPages ? { pageColors: DARK_PAGE } : {}),
      };
      const viewer = new kit.PDFViewer(options);
      links.setViewer(viewer);
      bus.on("pagesinit", () => {
        viewer.spreadMode = pdfTwoPages ? 1 : 0;
        // AnnotationEditorParamsType: INK_COLOR, INK_THICKNESS and HIGHLIGHT_COLOR.
        for (const [type, value] of [
          [21, pdfPen],
          [22, pdfPenSize],
          [31, pdfHighlight],
        ]) {
          bus.dispatch("switchannotationeditorparams", { source: null, type, value });
        }
      });
      bus.on("pagechanging", (e: { pageNumber: number }) => setPage(e.pageNumber));
      bus.on("updatefindmatchescount", (e: { matchesCount: { current: number; total: number } }) =>
        setMatches(e.matchesCount),
      );
      bus.on("updatefindcontrolstate", (e: { matchesCount: { current: number; total: number } }) =>
        setMatches(e.matchesCount),
      );

      const task = pdfjs.getDocument({ ...PDF_ASSETS, data: bytes.slice() });
      opened = task;
      const document = await task.promise;
      if (quit.signal.aborted) return;
      // Typed as null, but this is the hook pdf.js calls on the first change after a save.
      Object.assign(document.annotationStorage, { onSetModified: () => changed.current() });
      viewer.setDocument(document);
      links.setDocument(document);
      find.setDocument(document);
      setParts({ viewer, bus, find, document });
    })().catch((error: unknown) => {
      const locked = error instanceof Error && error.name === "PasswordException";
      showError(
        locked
          ? "This PDF has a password, which Penwork can't open yet."
          : "This PDF couldn't be opened.",
      );
    });

    return () => {
      quit.abort();
      setParts(null);
      void opened?.destroy();
    };
  }, [bytes, box, darkPages, pdfTwoPages, pdfPen, pdfHighlight, pdfPenSize]);

  useEffect(() => {
    handleRef.current = {
      fileBytes: async () => (await parts?.document.saveDocument()) ?? null,
      saved: () => parts?.document.annotationStorage.resetModified(),
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, parts]);

  const search = (text: string, findPrevious = false, again = false) => {
    setQuery(text);
    if (!text) setMatches(null);
    parts?.bus.dispatch("find", {
      source: null,
      type: again ? "again" : "",
      query: text,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      matchDiacritics: false,
      findPrevious,
    });
  };

  const choose = (next: PdfTool) => {
    setTool(next);
    if (parts) setEditorMode(parts.viewer, MODES[next]);
  };

  const colour = (value: string) => {
    // INK_COLOR, HIGHLIGHT_COLOR and FREETEXT_COLOR in pdf.js's AnnotationEditorParamsType.
    const type = tool === "draw" ? 21 : tool === "highlight" ? 31 : 12;
    parts?.bus.dispatch("switchannotationeditorparams", { source: null, type, value });
  };

  const goTo = (number: number) => {
    if (parts) showPage(parts.viewer, number);
  };

  return (
    <div
      className={styles.pdf}
      data-sidebar={sidebar || undefined}
      data-hide-bar={pdfHideBar || undefined}
      data-bar-hidden={barHidden || undefined}
    >
      <div ref={setBox} className={styles.pdfScroll} tabIndex={0}>
        <div className="pdfViewer" />
      </div>
      {sidebar && parts && (
        <PdfSidebar
          document={parts.document}
          page={page}
          onPage={goTo}
          onDestination={(dest) => {
            if (dest) void parts.viewer.linkService.goToDestination(dest);
          }}
        />
      )}
      {!parts && (
        <div className={styles.loading}>
          <LoadingIndicator label="Opening" size={48} />
        </div>
      )}
      {parts && toolsSlot && (
        <PdfToolbar
          slot={toolsSlot}
          startColours={{ draw: pdfPen, highlight: pdfHighlight }}
          page={page}
          pages={parts.document.numPages}
          scale={zoom.scale}
          fit={zoom.fit}
          sidebar={sidebar}
          tool={tool}
          query={query}
          matches={matches}
          onPage={goTo}
          onFit={zoom.chooseFit}
          onScale={zoom.chooseScale}
          onStep={(steps) => zoom.zoomAt({ steps })}
          onSidebar={() => setSidebar((open) => !open)}
          onTool={choose}
          onColour={colour}
          onSearch={search}
        />
      )}
    </div>
  );
}
