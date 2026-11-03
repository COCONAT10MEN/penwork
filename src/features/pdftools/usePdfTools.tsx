import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useEffect, useRef, useState } from "react";
import { fileStem } from "../../lib/office";
import { describePages } from "../../lib/pdftools/ranges";
import { notify, showError } from "../notices/notices";
import { runTool } from "./client";
import { deliver } from "./files";
import { OrganizeView } from "./OrganizeView";
import { askPassword } from "./passwordAsk";
import { PasswordPrompt } from "./PasswordPrompt";
import { PlaceLayer } from "./PlaceLayer";
import { ToolsSheet } from "./ToolsSheet";
import type { Lock, PlacedArea, PlaceSpec, ToolHost } from "./types";

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
  /** The file as Save would write it, before any password. */
  current: () => Promise<Uint8Array | null>;
  /** Show these bytes instead (unsaved). */
  show: (bytes: Uint8Array) => void;
  changed: () => void;
  goTo: (page: number) => void;
  lock: Lock | null;
  setLock: (lock: Lock | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [placing, setPlacing] = useState<{
    spec: PlaceSpec;
    done: (a: PlacedArea[] | null) => void;
  } | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const last = useRef<Uint8Array | null>(null);
  const opts = useRef(o);
  useEffect(() => {
    opts.current = o;
  });

  const current = async () => {
    const bytes = await opts.current.current();
    if (!bytes) throw new Error("The PDF is still opening.");
    last.current = bytes;
    return bytes;
  };

  const replace = async (bytes: Uint8Array, message: string) => {
    const before = last.current;
    opts.current.show(bytes);
    opts.current.changed();
    notify(
      message,
      "check_circle",
      before ? [{ label: "Undo", run: () => opts.current.show(before) }] : undefined,
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
        }
      : null;

  const layers = (
    <>
      <ToolsSheet
        open={open}
        hidden={placing !== null}
        host={host}
        onClose={() => setOpen(false)}
      />
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
