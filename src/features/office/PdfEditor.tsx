import type { PDFDocumentProxy } from "pdfjs-dist";
import type { EventBus, PDFFindController, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toPoints, toUnits, type PointStroke } from "../../lib/pdfInk";
import type { Fit } from "../../lib/pdfZoom";
import { LoadingIndicator } from "../../ui";
import { useSettings } from "../settings/settingsStore";
import { showError } from "../notices/notices";
import type { OfficeEditorProps } from "./officeFile";
import { PdfSidebar } from "./PdfSidebar";
import { PdfToolbar } from "./PdfToolbar";
import { putInk, takeInk } from "./pdfInkFile";
import { loadPdf, PDF_ASSETS } from "./pdfLoader";
import { useBarHiding } from "./useBarHiding";
import { measurePage } from "./flipViewer";
import { setPage as showPage } from "./pdfViewerSet";
import { usePdfZoom } from "./usePdfZoom";
import { usePageLayout, useReader, type PageInk } from "./useReader";
import styles from "./OfficeView.module.css";

// What pdf.js paints a page with, so these are data for it and not app colours.
const DARK_PAGE = { background: "#1b1b1f", foreground: "#e4e2e6" };
// Each page's picture tops out here and zooming further draws only what's on screen. Lower than
// pdf.js's own, because the laptop this is for has 8 GB shared with the graphics.
const MAX_CANVAS_PIXELS = 2 ** 24;
// pdf.js's AnnotationEditorType.DISABLE: its own markup tools are off, the slide toolbar replaces them.
const NO_EDITORS = -1;

interface Loaded {
  viewer: PDFViewer;
  bus: EventBus;
  find: PDFFindController;
  document: PDFDocumentProxy;
}

async function viewOf(document: PDFDocumentProxy, number: number) {
  return (await document.getPage(number)).getViewport({ scale: 1 });
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
  const { darkPages, pdfZoom, pdfTwoPages, pdfHideBar } = settings;
  const [parts, setParts] = useState<Loaded | null>(null);
  const [page, setPage] = useState(1);
  const [sidebar, setSidebar] = useState(false);
  const [markup, setMarkup] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<{ current: number; total: number } | null>(null);
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  });

  const reader = useReader(() => changed.current());
  const { box, frame } = reader;
  usePageLayout(frame, box, parts?.viewer ?? null);

  const [startFit] = useState<Fit | null>(() =>
    pdfZoom === "page-fit" ? "page" : pdfZoom === "100" ? null : "width",
  );
  const zoom = usePdfZoom(box, parts, { fit: startFit, scale: 1, across: pdfTwoPages ? 2 : 1 });
  const barHidden = useBarHiding(box, pdfHideBar, onBarHidden);

  useEffect(() => {
    frame?.contentDocument?.documentElement.toggleAttribute("data-hide-bar", pdfHideBar);
  }, [frame, pdfHideBar]);

  useEffect(() => {
    if (reader.failed) showError("The PDF reader couldn't start. Try opening the file again.");
  }, [reader.failed]);

  useEffect(() => {
    if (!bytes || !box) return;
    const quit = new AbortController();
    let opened: { destroy: () => Promise<void> } | null = null;

    void (async () => {
      const [{ pdfjs, viewer: kit }, taken] = await Promise.all([loadPdf(), takeInk(bytes)]);
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
        annotationEditorMode: NO_EDITORS,
        abortSignal: quit.signal,
        ...(darkPages ? { pageColors: DARK_PAGE } : {}),
      };
      const viewer = new kit.PDFViewer(options);
      links.setViewer(viewer);
      bus.on("pagesinit", () => {
        viewer.spreadMode = pdfTwoPages ? 1 : 0;
      });
      bus.on("pagechanging", (e: { pageNumber: number }) => setPage(e.pageNumber));
      bus.on("updatefindmatchescount", (e: { matchesCount: { current: number; total: number } }) =>
        setMatches(e.matchesCount),
      );
      bus.on("updatefindcontrolstate", (e: { matchesCount: { current: number; total: number } }) =>
        setMatches(e.matchesCount),
      );

      // pdf.js shows the file without Penwork's own ink: the engine draws that, and can change it.
      const task = pdfjs.getDocument({ ...PDF_ASSETS, data: taken.clean.slice() });
      opened = task;
      const document = await task.promise;
      if (quit.signal.aborted) return;
      // A filled-in form field is a change too.
      Object.assign(document.annotationStorage, { onSetModified: () => changed.current() });
      viewer.setDocument(document);
      links.setDocument(document);
      find.setDocument(document);
      setParts({ viewer, bus, find, document });

      const ink: PageInk = {};
      for (const [number, strokes] of Object.entries(taken.pages)) {
        const view = await viewOf(document, Number(number));
        ink[`p${number}`] = strokes.map((stroke) => toUnits(stroke, view));
      }
      if (!quit.signal.aborted && Object.keys(ink).length > 0) reader.setInk(ink);
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
    // reader.setInk only posts to the page, which `box` already stands for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bytes, box, darkPages, pdfTwoPages]);

  useEffect(() => {
    handleRef.current = {
      // The file as shown (with any form filled in), and then the ink on top as PDF ink.
      fileBytes: async () => {
        if (!parts) return null;
        const shown = await parts.document.saveDocument();
        const pages: Record<number, PointStroke[]> = {};
        for (const [key, strokes] of Object.entries(reader.ink.current)) {
          const number = Number(key.slice(1));
          if (!strokes.length || !number) continue;
          const view = await viewOf(parts.document, number);
          pages[number] = strokes.map((stroke) => toPoints(stroke, view));
        }
        return putInk(shown, pages);
      },
      saved: () => parts?.document.annotationStorage.resetModified(),
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, parts, reader.ink]);

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

  // The pages shrink to make room as the panel slides in, instead of jumping once it's there.
  const before = useRef<DOMRect | null>(null);
  const toggleSidebar = () => {
    if (box && parts) before.current = measurePage(box, parts.viewer.currentPageNumber);
    setSidebar((open) => !open);
  };
  // The panel shows first, and the pages make room in the next frame: done in one, the two together
  // were the one slow frame of the slide.
  useEffect(() => {
    const from = before.current;
    before.current = null;
    const next = requestAnimationFrame(() => {
      frame?.contentDocument?.documentElement.style.setProperty(
        "--pw-pdf-left",
        sidebar ? "200px" : "0px",
      );
      if (from) zoom.refit(from);
    });
    return () => cancelAnimationFrame(next);
    // Only the panel opening or closing moves the pages; zoom is read when that happens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebar, frame]);

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
      <iframe
        className={styles.pdfFrame}
        title={file.name}
        src="/reader/reader.html"
        onLoad={(e) => reader.onLoad(e.currentTarget)}
      />
      <AnimatePresence>
        {sidebar && parts && (
          <PdfSidebar
            key="pages"
            document={parts.document}
            page={page}
            onPage={goTo}
            onDestination={(dest) => {
              if (dest) void parts.viewer.linkService.goToDestination(dest);
            }}
          />
        )}
      </AnimatePresence>
      {!parts && (
        <div className={styles.loading}>
          <LoadingIndicator label="Opening" size={48} />
        </div>
      )}
      {parts && toolsSlot && (
        <PdfToolbar
          slot={toolsSlot}
          page={page}
          pages={parts.document.numPages}
          scale={zoom.scale}
          fit={zoom.fit}
          sidebar={sidebar}
          query={query}
          matches={matches}
          markup={markup}
          docState={reader.docState}
          onMarkup={() => {
            // Drawing starts with the pen, and leaving puts the pointer back for reading.
            reader.use(markup ? "ptr" : (reader.docState?.tool ?? "pen"));
            setMarkup(!markup);
          }}
          onUse={reader.use}
          onAct={reader.act}
          onSet={reader.set}
          onPage={goTo}
          onFit={zoom.chooseFit}
          onScale={zoom.chooseScale}
          onStep={zoom.step}
          onSidebar={toggleSidebar}
          onSearch={search}
        />
      )}
    </div>
  );
}
