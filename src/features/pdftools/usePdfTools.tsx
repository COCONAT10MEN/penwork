import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { fileStem } from "../../lib/office";
import { describePages } from "../../lib/pdftools/ranges";
import { notify, showError } from "../notices/notices";
import { runTool } from "./client";
import { deliver } from "./files";
import type { Addition } from "../../lib/pdftools/draw";
import { EditTextLayer, type TextEdit } from "./EditTextLayer";
import { runFont } from "./runFont";
import { OrganizeView } from "./OrganizeView";
import { asPrinted, sampleColors } from "./pageColors";
import { SelectionMarks } from "./SelectionMarks";
import { pageBox, selectedPieces, type Box } from "./selectionBoxes";
import { askPassword } from "./passwordAsk";
import { PasswordPrompt } from "./PasswordPrompt";
import { PlaceLayer } from "./PlaceLayer";
import { ToolsSheet, type SheetTab } from "./ToolsSheet";
import type { PdfSearch } from "./usePdfSearch";
import { NO_EDITS, type PageEdits, type Picked, type Stamp, type TextStyle } from "./pageEdits";
import type { Generic } from "./fontMatch";
import type { useEditHistory } from "./useEditHistory";
import type { PageEditsApi } from "./usePageEdits";
import type { Lock, PlacedArea, PlaceSpec, ToolHost } from "./types";

const STYLE_ON: Record<TextStyle, string> = {
  bold: "Made bold.",
  italic: "Made italic.",
  mono: "Made monospace.",
  underline: "Underlined.",
  strike: "Struck through.",
};
const STYLE_OFF: Record<TextStyle, string> = {
  bold: "Bold taken off.",
  italic: "Italic taken off.",
  mono: "Monospace taken off.",
  underline: "Underline taken off.",
  strike: "Strikethrough taken off.",
};

/**
 * The PDF tools on the PDF screen: the ⋮ sheet, placing things on pages, organizing, and passwords.
 * Tools change the file shown in place, unsaved, and Undo on the notice puts it back.
 */
export function usePdfTools(o: {
  name: string;
  path: string | null;
  doc: PDFDocumentProxy | null;
  viewer: PDFViewer | null;
  frame: HTMLIFrameElement | null;
  page: number;
  /** The file as Save would write it, before any password; without the edits not in it yet if asked. */
  current: (withEdits?: boolean) => Promise<Uint8Array | null>;
  /** Show these bytes instead (unsaved), with these edits over them; done once it's open. */
  show: (bytes: Uint8Array, edits?: PageEdits) => Promise<void>;
  changed: () => void;
  edits: PageEditsApi;
  history: ReturnType<typeof useEditHistory>;
  /** Settings ▸ Editing: off, the Edit and Shapes tools and styling selected text are put away. */
  editing: boolean;
  turnOnEditing: () => void;
  search: PdfSearch;
  /** Dark pages are on: colours read off a page are turned back to the file's own. */
  dark: boolean;
  goTo: (page: number) => void;
  lock: Lock | null;
  setLock: (lock: Lock | null) => void;
}) {
  const [open, setOpen] = useState(false);
  // Kept between openings: the tab used last is where the next look starts.
  const [tab, setTab] = useState<SheetTab>("pages");
  const [focusSearch, setFocusSearch] = useState(0);
  const [placing, setPlacing] = useState<{
    spec: PlaceSpec;
    done: (a: PlacedArea[] | null) => void;
  } | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [editing, setEditing] = useState(false);
  // What the last tool read: the file without the edits not in it yet, and those edits, for its Undo.
  const last = useRef<{ bytes: Uint8Array; edits: PageEdits } | null>(null);
  // Words changed with Edit text, by where they are: changing them again replaces the change.
  const edited = useRef(new Map<string, { text: string; things: Addition[] }>());
  const opts = useRef(o);
  useEffect(() => {
    opts.current = o;
  });

  const current = async () => {
    const plain = await opts.current.current(false);
    if (!plain) throw new Error("The PDF is still opening.");
    last.current = { bytes: plain, edits: opts.current.edits.snapshot() };
    return opts.current.edits.bake(plain);
  };

  /** A step in the PDF's one history, with Undo on its notice while it's still the last. */
  const remember = (message: string, undo: () => unknown, redo: () => unknown) => {
    const again = (run: () => unknown) => async () => {
      await run();
      opts.current.changed();
    };
    const id = opts.current.history.add({ undo: again(undo), redo: again(redo) });
    notify(message, "check_circle", [{ label: "Undo", run: () => opts.current.history.undo(id) }]);
  };

  const replace = async (bytes: Uint8Array, message: string) => {
    const before = last.current;
    void opts.current.show(bytes);
    opts.current.changed();
    if (!before) return notify(message, "check_circle");
    remember(
      message,
      () => opts.current.show(before.bytes, before.edits),
      () => opts.current.show(bytes, NO_EDITS),
    );
  };

  /** A change made over the pages, at once, with no reload: a step in Undo like any other. */
  const live = (message: string, make: (e: PageEdits) => PageEdits) => {
    const { edits } = opts.current;
    const { before, after } = edits.change(make);
    opts.current.changed();
    remember(
      message,
      () => edits.set(before),
      () => edits.set(after),
    );
  };

  const host: ToolHost | null =
    o.doc && o.viewer
      ? {
          name: o.name,
          path: o.path,
          doc: o.doc,
          page: o.page,
          current,
          replace,
          addLive: (things, message) => {
            if (things.length) live(message, (e) => ({ ...e, things: [...e.things, ...things] }));
          },
          addStamp: (stamp: Stamp, message) =>
            live(message, (e) => ({ ...e, stamps: [...e.stamps, stamp] })),
          goTo: o.goTo,
          lock: o.lock,
          setLock: (lock) => {
            opts.current.setLock(lock);
            opts.current.changed();
          },
          place: (spec) =>
            new Promise((done) => {
              setPlacing({
                spec,
                done: (areas) => {
                  setPlacing(null);
                  done(areas);
                },
              });
            }),
          organize: () => {
            setOpen(false);
            setOrganizing(true);
          },
          editText: () => {
            setOpen(false);
            setEditing(true);
          },
          // The same message the toolbar gets with its saved settings when the PDF opens.
          // The same message the toolbar gets when the PDF opens, marked live so buttons turned
          // on or off grow in or fold away instead of the toolbar being laid out again.
          toolbarChanged: (settings) =>
            o.frame?.contentWindow?.postMessage(
              { v: 1, type: "toolbar", payload: { ...settings, live: true } },
              location.origin,
            ),
        }
      : null;

  /**
   * Bold, italic, monospace, underline or strike through for the selected words, shown at once
   * over the page and written into the file on Save. Pressed again on the same words, it comes off.
   */
  const style = (kind: TextStyle) => {
    const doc = opts.current.frame?.contentDocument;
    const viewer = opts.current.viewer;
    if (!doc || !viewer) return;
    // Read now: the selection is cleared as soon as the bar's button is pressed.
    const pieces = selectedPieces(doc).flatMap((piece) => {
      const at = pageBox(viewer, piece.page, piece.rect);
      if (!at) return [];
      const family = getComputedStyle(piece.span).fontFamily.toLowerCase();
      const colors = sampleColors(piece.page, piece.rect);
      const font: Generic = /mono|courier/.test(family)
        ? "mono"
        : /serif/.test(family) && !/sans/.test(family)
          ? "serif"
          : "sans";
      return [
        {
          page: at.n,
          box: at.box,
          text: piece.text,
          font,
          paper: asPrinted(colors.paper, opts.current.dark),
          ink: asPrinted(colors.ink, opts.current.dark),
        },
      ];
    });
    if (!pieces.length) return;
    void (async () => {
      // Then the font each run is set in, from the PDF.
      const picked: Picked[] = await Promise.all(
        pieces.map(async (p) => ({ ...p, run: await runFont(viewer, p.page, p.box) })),
      );
      const { edits } = opts.current;
      const { on, before, after } = await edits.style(picked, kind);
      opts.current.changed();
      remember(
        on ? STYLE_ON[kind] : STYLE_OFF[kind],
        () => edits.set(before),
        () => edits.set(after),
      );
    })();
  };

  const keyOf = (page: number, box: Box) => `${page}:${box.map((v) => Math.round(v)).join(",")}`;

  /** Words changed with Edit text: painted over, and written in their own font on their own line. */
  const applyEdit = (e: TextEdit) => {
    const [x0, y0, x1, y1] = e.box;
    const dark = opts.current.dark;
    const size = e.run?.size ?? (y1 - y0) * 0.8;
    const things: Addition[] = [
      {
        kind: "cover",
        area: {
          page: e.page,
          x: x0 - 0.6,
          y: y0 - 0.6,
          width: x1 - x0 + 1.2,
          height: y1 - y0 + 1.2,
        },
        color: asPrinted(e.paper, dark),
      },
      {
        kind: "text",
        area: { page: e.page, x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
        text: e.text,
        size,
        color: asPrinted(e.ink, dark),
        font: e.face.generic,
        bold: e.face.bold,
        italic: e.face.italic,
        face: { css: e.face.css, installed: e.face.installed },
        baseline: e.run?.baseline ?? y0 + (y1 - y0) * 0.22,
        // The old words' spacing between letters, so the new ones read as part of the same text.
        track: { text: e.was, width: x1 - x0 },
      },
    ];
    const key = keyOf(e.page, e.box);
    const earlier = edited.current.get(key)?.things ?? [];
    edited.current.set(key, { text: e.text, things });
    live("Text changed.", (all) => ({
      ...all,
      things: [...all.things.filter((t) => !earlier.includes(t)), ...things],
    }));
  };

  /** The words' text after an earlier edit that's still there (not undone). */
  const shownText = (page: number, box: Box) => {
    const known = edited.current.get(keyOf(page, box));
    const now = opts.current.edits.snapshot().things;
    return known && known.things.every((t) => now.includes(t)) ? known.text : null;
  };

  const layers = (
    <>
      <ToolsSheet
        open={open}
        hidden={placing !== null}
        host={host}
        editing={o.editing}
        onEditing={o.turnOnEditing}
        search={o.search}
        tab={tab}
        onTab={setTab}
        focusSearch={focusSearch}
        onClose={() => setOpen(false)}
      />
      {o.frame && o.viewer && !editing && !placing && (
        <SelectionMarks frame={o.frame} canStyle={o.editing} onStyle={style} />
      )}
      {editing && o.frame && o.viewer && (
        <EditTextLayer
          frame={o.frame}
          viewer={o.viewer}
          shownText={shownText}
          onEdit={applyEdit}
          onDone={() => setEditing(false)}
        />
      )}
      {placing && o.frame && o.viewer && (
        <PlaceLayer frame={o.frame} viewer={o.viewer} spec={placing.spec} onDone={placing.done} />
      )}
      <AnimatePresence>
        {organizing && o.doc && (
          <OrganizeView
            doc={o.doc}
            onDone={async (order) => {
              setOrganizing(false);
              if (!order) return;
              try {
                await replace(
                  await runTool("arrange", [await current(), order]),
                  "Pages organized.",
                );
              } catch (e) {
                showError(e instanceof Error ? e.message : String(e));
              }
            }}
            onExtract={async (pages) => {
              try {
                if (!o.path)
                  throw new Error(
                    "Save this PDF first, so there's a folder to put the new file in.",
                  );
                const bytes = await runTool("copyOut", [await current(), pages]);
                await deliver(
                  o.path,
                  [{ name: `${fileStem(o.path)} pages ${describePages(pages)}.pdf`, bytes }],
                  "",
                );
              } catch (e) {
                showError(e instanceof Error ? e.message : String(e));
              }
            }}
          />
        )}
      </AnimatePresence>
      <PasswordPrompt />
    </>
  );

  // Ctrl+F opens Search, on the page or anywhere in the app; F3 and Shift+F3 step through the
  // results, as in Office.
  useEffect(() => {
    const openSearch = () => {
      setTab("search");
      setOpen(true);
      setFocusSearch((n) => n + 1);
    };
    const press = (key: string, ctrl: boolean, shift: boolean) => {
      if (ctrl && key.toLowerCase() === "f") openSearch();
      else if (key === "F3") opts.current.search.step(shift);
      else return false;
      return true;
    };
    const onKey = (e: KeyboardEvent) => {
      if (press(e.key, e.ctrlKey, e.shiftKey)) e.preventDefault();
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== opts.current.frame?.contentWindow || e.data?.v !== 1) return;
      if (e.data.type !== "key") return;
      const p = e.data.payload as { key: string; ctrl: boolean; shift: boolean };
      press(p.key, p.ctrl, p.shift);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return { host, layers, open, setOpen };
}

/**
 * A PDF with a password is opened through qpdf with it, and the person's password is kept to put
 * back on when saving. One with only restrictions (no password to open) opens straight away.
 */
export async function unlockIfNeeded(
  bytes: Uint8Array,
  name: string,
): Promise<{ bytes: Uint8Array; lock: Lock | null } | null> {
  if (!(await runTool("isEncrypted", [bytes]))) return { bytes, lock: null };
  try {
    return { bytes: await runTool("unlock", [bytes, ""]), lock: null };
  } catch (e) {
    if (!(e instanceof Error) || e.message !== "PASSWORD") throw e;
  }
  for (let wrong = false; ; wrong = true) {
    const password = await askPassword(name, wrong);
    if (password === null) return null;
    try {
      const open = await runTool("unlock", [bytes, password]);
      return { bytes: open, lock: { password, allow: { print: true, copy: true, edit: true } } };
    } catch (e) {
      if (!(e instanceof Error) || e.message !== "PASSWORD") throw e;
    }
  }
}
