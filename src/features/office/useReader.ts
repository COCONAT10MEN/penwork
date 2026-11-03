import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { penworkLogoSvg } from "../../ui";
import { exportToolbar, importToolbar, loadToolbar, saveToolbar } from "../deck/toolbarFile";
import { dockColors } from "../settings/appearance";
import { useSettings } from "../settings/settingsStore";

/** A stroke as the engine keeps it: page units, 1920 across the page (docs/PDF-INK.md). */
export interface EngineStroke {
  k: "p" | "h";
  c: string;
  w: number;
  op?: number;
  np?: boolean;
  pts: [number, number, number][];
}
export type PageInk = Record<string, EngineStroke[]>;

export type ToolId = "pen" | "hl" | "laser" | "eraser";

/** The slide toolbar in the top bar, as the engine reports it: the bar makes room while it's open. */
export interface DocState {
  open: boolean;
  tool: ToolId;
  annot: boolean;
}

interface DocApi {
  layout: (
    pages: { n: number; x: number; y: number; w: number; h: number }[],
    current: number,
  ) => void;
}

/**
 * The reader page: pdf.js's pages and the slide engine's dock and ink in one same-origin document.
 * The app gives it its colours and keys, tells the engine where each page is after every scroll or
 * zoom, and collects the ink the engine reports.
 */
export function useReader(onInk: (ink: PageInk) => void) {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  // Set the moment the page has loaded: it says it's ready in that same moment, before React has
  // caught up with the state above, and that message must not be missed.
  const loaded = useRef<HTMLIFrameElement | null>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [docState, setDocState] = useState<DocState | null>(null);
  const [ready, setReady] = useState(false);
  const ink = useRef<PageInk>({});
  const report = useRef(onInk);
  useEffect(() => {
    report.current = onInk;
  });

  const post = useCallback(
    (type: string, payload: unknown) =>
      loaded.current?.contentWindow?.postMessage({ v: 1, type, payload }, location.origin),
    [],
  );

  // The page is the app's own, so it takes the app's colour tokens straight from it, and again
  // whenever the theme changes.
  useEffect(() => {
    const doc = frame?.contentDocument;
    if (!frame || !doc) return;
    const copy = () => {
      const css = getComputedStyle(document.documentElement);
      const root = doc.documentElement;
      for (const name of css)
        if (name.startsWith("--")) root.style.setProperty(name, css.getPropertyValue(name));
      root.style.setProperty("color-scheme", css.colorScheme);
      // The bar's glass is drawn in the page, and goes solid with the app's Transparency setting.
      const transparency = document.documentElement.getAttribute("data-transparency");
      if (transparency) root.setAttribute("data-transparency", transparency);
      else root.removeAttribute("data-transparency");
    };
    copy();
    const watcher = new MutationObserver(copy);
    watcher.observe(document.documentElement, { attributes: true });
    watcher.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => watcher.disconnect();
  }, [frame]);

  // Keys pressed in the page reach the app's own shortcuts: Save, zoom, full screen.
  useEffect(() => {
    const win = frame?.contentWindow;
    if (!win) return;
    const onKey = (e: KeyboardEvent) => {
      const copy = new KeyboardEvent("keydown", e);
      window.dispatchEvent(copy);
      if (copy.defaultPrevented) e.preventDefault();
    };
    win.addEventListener("keydown", onKey);
    return () => win.removeEventListener("keydown", onKey);
  }, [frame]);

  // What the engine says: it's ready, its settings changed, ink changed, or full screen.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!e.source || e.source !== loaded.current?.contentWindow || e.data?.v !== 1) return;
      const { type, payload } = e.data as { type: string; payload: Record<string, unknown> };
      if (type === "ready") {
        setReady(true);
        void loadToolbar().then((toolbar) => toolbar && post("toolbar", toolbar));
        const { settings, systemSeed } = useSettings.getState();
        post("logo", {
          svg: settings.logo?.svg ?? penworkLogoSvg(),
          ...dockColors(settings, systemSeed),
        });
        if (Object.keys(ink.current).length > 0) post("ink", { slides: ink.current });
      } else if (type === "toolbar") {
        // The settings are the whole message, as from a presentation (see lib/deck/bridge).
        saveToolbar(payload);
      } else if (type === "exportToolbar") {
        void exportToolbar(String(payload.text));
      } else if (type === "importToolbar") {
        void importToolbar((text) => post("toolbarFile", { text }));
      } else if (type === "end" && isTauri()) {
        const win = getCurrentWindow();
        void win.isFullscreen().then((on) => win.setFullscreen(!on));
      } else if (type === "docState") {
        setDocState(payload as unknown as DocState);
      } else if (type === "ink" && typeof payload.id === "string") {
        ink.current = { ...ink.current, [payload.id]: payload.strokes as EngineStroke[] };
        report.current(ink.current);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post]);

  /** Ink read from the file, handed to the engine to draw and edit. */
  const setInk = useCallback(
    (pages: PageInk) => {
      ink.current = pages;
      post("ink", { slides: pages });
    },
    [post],
  );

  // Only the app's own reader page is used. Anything else (a blocked or failed load) is left alone,
  // because reaching into a page from elsewhere throws.
  const onLoad = (element: HTMLIFrameElement) => {
    let scroller: HTMLDivElement | null;
    try {
      scroller = element.contentDocument?.getElementById("scroller") as HTMLDivElement | null;
    } catch {
      scroller = null;
    }
    if (!scroller) {
      setFailed(true);
      return;
    }
    loaded.current = element;
    setFrame(element);
    setBox(scroller);
  };

  const api = () =>
    (loaded.current?.contentWindow as (Window & { __pwDoc?: DocApi }) | null)?.__pwDoc;

  return { frame, box, failed, ready, onLoad, setInk, ink, docState, api };
}

/**
 * Keeps the engine told where every page on screen is, on each scroll in the same frame, so ink
 * never lags behind its page.
 */
export function usePageLayout(
  frame: HTMLIFrameElement | null,
  box: HTMLElement | null,
  viewer: PDFViewer | null,
) {
  useEffect(() => {
    const win = frame?.contentWindow as (Window & { __pwDoc?: DocApi }) | null | undefined;
    if (!win || !box || !viewer) return;
    let frameId = 0;
    const send = () => {
      const api = win.__pwDoc;
      if (!api) return;
      const view = box.getBoundingClientRect();
      const current = viewer.currentPageNumber;
      const pages = [];
      for (let n = Math.max(1, current - 4); n <= Math.min(viewer.pagesCount, current + 4); n++) {
        const page = box.querySelector(`.page[data-page-number="${n}"]`);
        const r = page?.getBoundingClientRect();
        if (!r || r.bottom < view.top || r.top > view.bottom || r.width === 0) continue;
        pages.push({ n, x: r.left, y: r.top, w: r.width, h: r.height });
      }
      api.layout(pages, current);
    };
    // Scroll and zoom events already come once a frame. One more after the last catches the
    // pages that pdf.js lays out just after it. Animations need nothing: the ink plays them too.
    const kick = () => {
      send();
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(send);
    };
    box.addEventListener("scroll", kick, { passive: true });
    viewer.eventBus.on("scalechanging", kick);
    viewer.eventBus.on("pagesinit", kick);
    viewer.eventBus.on("pagerendered", kick);
    const watcher = new ResizeObserver(kick);
    watcher.observe(box);
    kick();
    return () => {
      cancelAnimationFrame(frameId);
      box.removeEventListener("scroll", kick);
      viewer.eventBus.off("scalechanging", kick);
      viewer.eventBus.off("pagesinit", kick);
      viewer.eventBus.off("pagerendered", kick);
      watcher.disconnect();
    };
  }, [frame, box, viewer]);
}
