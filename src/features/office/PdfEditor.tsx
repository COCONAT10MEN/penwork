import type { PDFDocumentProxy } from "pdfjs-dist";
import type { EventBus, PDFFindController, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useEffect, useRef, useState } from "react";
import { LoadingIndicator } from "../../ui";
import { showError } from "../notices/notices";
import type { OfficeEditorProps } from "./officeFile";
import { PdfToolbar, type PdfTool } from "./PdfToolbar";
import { loadPdf, PDF_ASSETS } from "./pdfLoader";
import styles from "./OfficeView.module.css";

/** Numbers from pdf.js's AnnotationEditorType. */
const MODES: Record<PdfTool, number> = { select: 0, text: 3, highlight: 9, draw: 15 };
const HIGHLIGHT_COLORS = "yellow=#FFFF98,green=#53FFBC,blue=#80EBFF,pink=#FFCBE6,red=#FF4F5F";

interface Loaded {
  viewer: PDFViewer;
  bus: EventBus;
  find: PDFFindController;
  document: PDFDocumentProxy;
}

export default function PdfEditor({ file, handleRef, onChange }: OfficeEditorProps) {
  const container = useRef<HTMLDivElement>(null);
  const pdf = useRef<Loaded | null>(null);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [tool, setTool] = useState<PdfTool>("select");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<{ current: number; total: number } | null>(null);
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  });

  useEffect(() => {
    const bytes = file.bytes;
    const box = container.current;
    if (!bytes || !box) return;
    const quit = new AbortController();
    let opened: { destroy: () => Promise<void> } | null = null;

    void (async () => {
      const { pdfjs, viewer: parts } = await loadPdf();
      if (quit.signal.aborted) return;
      const bus = new parts.EventBus();
      const links = new parts.PDFLinkService({ eventBus: bus });
      const find = new parts.PDFFindController({ eventBus: bus, linkService: links });
      const options = {
        container: box,
        eventBus: bus,
        linkService: links,
        findController: find,
        annotationEditorMode: MODES.select,
        annotationEditorHighlightColors: HIGHLIGHT_COLORS,
        abortSignal: quit.signal,
      };
      const viewer = new parts.PDFViewer(options);
      links.setViewer(viewer);
      bus.on("pagesinit", () => {
        viewer.currentScaleValue = "auto";
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
      pdf.current = { viewer, bus, find, document };
      setPages(document.numPages);
      setReady(true);
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
      pdf.current = null;
      void opened?.destroy();
    };
  }, [file]);

  useEffect(() => {
    handleRef.current = {
      fileBytes: async () => (await pdf.current?.document.saveDocument()) ?? null,
      saved: () => pdf.current?.document.annotationStorage.resetModified(),
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef]);

  const search = (text: string, findPrevious = false, again = false) => {
    setQuery(text);
    if (!text) setMatches(null);
    pdf.current?.bus.dispatch("find", {
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
    if (pdf.current) pdf.current.viewer.annotationEditorMode = { mode: MODES[next] };
  };

  const zoom = (way: "in" | "out" | "fit") => {
    if (!pdf.current) return;
    const { viewer } = pdf.current;
    if (way === "in") viewer.increaseScale();
    else if (way === "out") viewer.decreaseScale();
    else pdf.current.viewer.currentScaleValue = "page-width";
  };

  const colour = (value: string) => {
    // INK_COLOR, HIGHLIGHT_COLOR and FREETEXT_COLOR in pdf.js's AnnotationEditorParamsType.
    const type = tool === "draw" ? 21 : tool === "highlight" ? 31 : 12;
    pdf.current?.bus.dispatch("switchannotationeditorparams", { source: null, type, value });
  };

  return (
    <div className={styles.pdf}>
      <div ref={container} className={styles.pdfScroll} tabIndex={0}>
        <div className="pdfViewer" />
      </div>
      {!ready && (
        <div className={styles.loading}>
          <LoadingIndicator label="Opening" size={48} />
        </div>
      )}
      {ready && (
        <PdfToolbar
          page={page}
          pages={pages}
          tool={tool}
          query={query}
          matches={matches}
          onPage={(next) => {
            if (pdf.current) pdf.current.viewer.currentPageNumber = next;
          }}
          onZoom={zoom}
          onTool={choose}
          onColour={colour}
          onSearch={search}
        />
      )}
    </div>
  );
}
