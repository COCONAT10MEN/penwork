import type { PDFDocumentProxy } from "pdfjs-dist";
import type { EventBus, PDFFindController, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toPoints, toUnits, type PointStroke } from "../../lib/pdfInk";
import type { Fit } from "../../lib/pdfZoom";
import { LoadingIndicator } from "../../ui";
import { useSettings } from "../settings/settingsStore";
import { askGoAhead, showError } from "../notices/notices";
import { runTool } from "../pdftools/client";
import type { Lock } from "../pdftools/types";
import { DARK_PAGE } from "../pdftools/pageColors";
import { unlockIfNeeded, usePdfTools } from "../pdftools/usePdfTools";
import { useTextStyles } from "../pdftools/useTextStyles";
import type { OfficeEditorProps } from "./officeFile";
import { PdfSidebar } from "./PdfSidebar";
import { PdfToolbar } from "./PdfToolbar";
import { putInk, takeInk } from "./pdfInkFile";
import { loadPdf, PDF_ASSETS } from "./pdfLoader";
import { useBarHiding } from "./useBarHiding";
import { measurePage } from "./flipViewer";
import { setPage as showPage } from "./pdfViewerSet";
import { usePdfZoom } from "./usePdfZoom";
import { useDockSeat } from "./useDockSeat";
import { usePageLayout, useReader, type PageInk } from "./useReader";
import styles from "./OfficeView.module.css";

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
  onBarGlass,
}: OfficeEditorProps) {
  const { bytes } = file;
  // What pdf.js shows: the file without its password, or as a tool changed it.
  const [source, setSource] = useState<Uint8Array | null>(null);
  const [lock, setLock] = useState<Lock | null>(null);
  // Where the reader was, to come back to after a tool changes the file.
  const keepPage = useRef(0);
  const settings = useSettings((s) => s.settings);
  const { darkPages, pdfZoom, pdfTwoPages, pdfHideBar, pdfInk } = settings;
  const [parts, setParts] = useState<Loaded | null>(null);
  // Bold, underline and the rest, shown over the pages until the file is written.
  const textStyles = useTextStyles(parts?.viewer ?? null, darkPages, source);
  const [page, setPage] = useState(1);
  const [sidebar, setSidebar] = useState(false);
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

  // The annotation tools fold away when switched off, and come back when switched on; when the
  // PDF opens they're simply there or not.
  const inkShown = useRef<boolean | null>(null);
  useEffect(() => {
    if (!reader.ready) return;
    const first = inkShown.current === null;
    inkShown.current = pdfInk;
    frame?.contentWindow?.postMessage(
      { v: 1, type: "inkOff", payload: { off: !pdfInk, ani: !first } },
      location.origin,
    );
  }, [frame, reader.ready, pdfInk]);

  // The page draws the bar's glass, with the slide toolbar in it, once it's there to do so.
  useEffect(() => {
    onBarGlass?.(reader.ready);
    return () => onBarGlass?.(false);
  }, [reader.ready, onBarGlass]);

  // The bar's glass and the slide toolbar go up with the bar while reading.
  useEffect(() => {
    frame?.contentDocument?.documentElement.toggleAttribute("data-bar-hidden", barHidden);
  }, [frame, barHidden]);

  useDockSeat(frame, toolsSlot, !!parts);

  useEffect(() => {
    if (reader.failed) showError("The PDF reader couldn't start. Try opening the file again.");
  }, [reader.failed]);

  // A file with a password is opened with it first.
  useEffect(() => {
    if (!bytes) return;
    let gone = false;
    unlockIfNeeded(bytes, file.name)
      .then((open) => {
        if (gone) return;
        if (!open) return showError("Without its password this PDF can't be shown.", "Not opened");
        setLock(open.lock);
        setSource(open.bytes);
      })
      .catch(() => !gone && setSource(bytes));
    return () => {
      gone = true;
    };
  }, [bytes, file.name]);

  useEffect(() => {
    if (!source || !box) return;
    const bytes = source;
    const back = keepPage.current;
    const quit = new AbortController();
    let opened: { destroy: () => Promise<void> } | null = null;
    let shown: PDFViewer | null = null;
    let pageTimer: ReturnType<typeof setTimeout> | 0 = 0;

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
        // pdf.js's own drawing of a selection needs its editors, which are off; the page's normal
        // selection shows instead, in the app's colour (reader.css).
        enableSelectionRendering: false,
        abortSignal: quit.signal,
        ...(darkPages ? { pageColors: DARK_PAGE } : {}),
      };
      const viewer = new kit.PDFViewer(options);
      shown = viewer;
      links.setViewer(viewer);
      bus.on("pagesinit", () => {
        viewer.spreadMode = pdfTwoPages ? 1 : 0;
        if (back > 1) showPage(viewer, Math.min(back, viewer.pagesCount));
      });
      // At most four times a second while scrolling: each change rolls the number in the bar, and
      // ten rolls a second through a long PDF cost a quarter of every frame. The last always shows.
      let wanted = 0;
      bus.on("pagechanging", (e: { pageNumber: number }) => {
        wanted = e.pageNumber;
        if (pageTimer) return;
        setPage(wanted);
        pageTimer = setTimeout(function settle() {
          pageTimer = 0;
          setPage(wanted);
        }, 250);
      });
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
      // After a tool, the ink moves with its pages, and pages without any are cleared.
      if (!quit.signal.aborted && (back > 0 || Object.keys(ink).length > 0)) reader.setInk(ink);
    })().catch(async (error: unknown) => {
      if (quit.signal.aborted) return;
      const yes = await askGoAhead({
        title: "This PDF couldn't be opened",
        text: "It may be damaged. Penwork can try to rebuild it; the file itself isn't changed unless you save.",
        ok: "Try to repair",
        cancel: "Not now",
        icon: "build",
      });
      if (!yes) return;
      try {
        setSource(await runTool("repair", [bytes]));
        changed.current();
      } catch {
        showError("It's too damaged to repair.");
      }
      void error;
    });

    return () => {
      quit.abort();
      clearTimeout(pageTimer || undefined);
      setParts(null);
      // The old viewer lets go of its pages and stops adding any, before the next one starts.
      shown?.setDocument(null as unknown as PDFDocumentProxy);
      box.querySelector(".pdfViewer")?.replaceChildren();
      void opened?.destroy();
    };
    // reader.setInk only posts to the page, which `box` already stands for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, box, darkPages, pdfTwoPages]);

  // The file as shown (with any form filled in), and then the ink on top as PDF ink.
  const asSaved = async () => {
    if (!parts) return null;
    const shown = await textStyles.bake(await parts.document.saveDocument());
    const pages: Record<number, PointStroke[]> = {};
    for (const [key, strokes] of Object.entries(reader.ink.current)) {
      const number = Number(key.slice(1));
      if (!strokes.length || !number) continue;
      const view = await viewOf(parts.document, number);
      pages[number] = strokes.map((stroke) => toPoints(stroke, view));
    }
    return putInk(shown, pages);
  };

  useEffect(() => {
    handleRef.current = {
      // With its password put back on, when it has one.
      fileBytes: async () => {
        const plain = await asSaved();
        if (!plain || !lock) return plain;
        return runTool("protect", [plain, lock.password, "", lock.allow]);
      },
      saved: () => parts?.document.annotationStorage.resetModified(),
    };
    return () => {
      handleRef.current = null;
    };
    // asSaved reads parts and the ink, which are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleRef, parts, reader.ink, lock]);

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

  const tools = usePdfTools({
    name: file.name,
    path: file.path,
    doc: parts?.document ?? null,
    viewer: parts?.viewer ?? null,
    frame,
    page,
    current: asSaved,
    show: (next) => {
      keepPage.current = page;
      setSource(next);
    },
    changed: () => changed.current(),
    textStyles,
    dark: darkPages,
    goTo,
    lock,
    setLock,
  });

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
          onPage={goTo}
          onFit={zoom.chooseFit}
          onScale={zoom.chooseScale}
          onStep={zoom.step}
          onSidebar={toggleSidebar}
          onSearch={search}
          inkOff={!pdfInk}
          moreOpen={tools.open}
          onMore={() => tools.setOpen(!tools.open)}
        />
      )}
      {tools.layers}
    </div>
  );
}
