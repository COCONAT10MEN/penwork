import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useEffect, useRef, useState } from "react";
import { fileStem } from "../../lib/office";
import { describePages } from "../../lib/pdftools/ranges";
import { notify, showError } from "../notices/notices";
import { runTool } from "./client";
import { deliver } from "./files";
import type { Addition } from "../../lib/pdftools/draw";
import { EditTextLayer, type TextEdit } from "./EditTextLayer";
import { OrganizeView } from "./OrganizeView";
import { asPrinted, sampleColors } from "./pageColors";
import { SelectionMarks } from "./SelectionMarks";
import { pageBox, selectedPieces } from "./selectionBoxes";
import { textThing } from "./toolsEdit";
import { askPassword } from "./passwordAsk";
import { PasswordPrompt } from "./PasswordPrompt";
import { PlaceLayer } from "./PlaceLayer";
import { ToolsSheet, type SheetTab } from "./ToolsSheet";
import type { PdfSearch } from "./usePdfSearch";
import { NO_STYLES, type Face, type Picked, type TextStyle, type TextStyles } from "./textStyles";
import type { useEditHistory } from "./useEditHistory";
import type { useTextStyles } from "./useTextStyles";
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
  /** The file as Save would write it, before any password; without the text styles if asked. */
  current: (withStyles?: boolean) => Promise<Uint8Array | null>;
  /** Show these bytes instead (unsaved), with these text styles over them; done once it's open. */
  show: (bytes: Uint8Array, styles?: TextStyles) => Promise<void>;
  changed: () => void;
  textStyles: ReturnType<typeof useTextStyles>;
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
  // What the last tool read: the file without its text styles, and the styles, for its Undo.
  const last = useRef<{ bytes: Uint8Array; styles: TextStyles } | null>(null);
  const opts = useRef(o);
  useEffect(() => {
    opts.current = o;
  });

  const current = async () => {
    const plain = await opts.current.current(false);
    if (!plain) throw new Error("The PDF is still opening.");
    last.current = { bytes: plain, styles: opts.current.textStyles.snapshot() };
    return opts.current.textStyles.bake(plain);
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
      () => opts.current.show(before.bytes, before.styles),
      () => opts.current.show(bytes, NO_STYLES),
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
    const picked: Picked[] = [];
    for (const piece of selectedPieces(doc)) {
      const at = pageBox(viewer, piece.page, piece.rect);
      if (!at) continue;
      const family = getComputedStyle(piece.span).fontFamily.toLowerCase();
      const colors = sampleColors(piece.page, piece.rect);
      picked.push({
        page: at.n,
        box: at.box,
        text: piece.text,
        font: (/mono|courier/.test(family)
          ? "mono"
          : /serif/.test(family) && !/sans/.test(family)
            ? "serif"
            : "sans") as Face,
        paper: asPrinted(colors.paper, opts.current.dark),
        ink: asPrinted(colors.ink, opts.current.dark),
      });
    }
    if (!picked.length) return;
    const { textStyles } = opts.current;
    const { on, before, after } = textStyles.apply(picked, kind);
    opts.current.changed();
    remember(
      on ? STYLE_ON[kind] : STYLE_OFF[kind],
      () => textStyles.set(before),
      () => textStyles.set(after),
    );
  };

  const applyEdits = async (edits: TextEdit[]) => {
    const things: Addition[] = [];
    for (const e of edits) {
      // The old words go under the paper's colour; the new ones sit on the same baseline.
      things.push({
        kind: "cover",
        area: {
          page: e.page,
          x: e.x - 0.6,
          y: e.y - 0.6,
          width: e.width + 1.2,
          height: e.height + 1.2,
        },
        color: e.paper,
      });
      const area = {
        page: e.page,
        x: e.x,
        y: e.y,
        width: Math.max(e.width, e.text.length * e.size * 0.6),
        height: e.size,
      };
      things.push(await textThing(area, e.text, e.size, e.ink, e.font));
    }
    try {
      await replace(
        await runTool("addThings", [await current(), things]),
        edits.length === 1 ? "Text changed." : `${edits.length} changes made.`,
      );
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e));
    }
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
          onDone={(edits) => {
            setEditing(false);
            if (edits) void applyEdits(edits);
          }}
        />
      )}
      {placing && o.frame && o.viewer && (
        <PlaceLayer frame={o.frame} viewer={o.viewer} spec={placing.spec} onDone={placing.done} />
      )}
      {organizing && o.doc && (
        <OrganizeView
          doc={o.doc}
          onDone={async (order) => {
            setOrganizing(false);
            if (!order) return;
            try {
              await replace(await runTool("arrange", [await current(), order]), "Pages organized.");
            } catch (e) {
              showError(e instanceof Error ? e.message : String(e));
            }
          }}
          onExtract={async (pages) => {
            try {
              if (!o.path)
                throw new Error("Save this PDF first, so there's a folder to put the new file in.");
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
