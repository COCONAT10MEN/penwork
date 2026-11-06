import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Area } from "../../lib/pdftools/draw";
import type { MarkKind } from "../../lib/pdftools/markup";
import type { Change } from "./compare";

/** What a tool can do with the open PDF, given by the PDF screen. */
export interface ToolHost {
  name: string;
  path: string | null;
  doc: PDFDocumentProxy;
  page: number;
  /** The file as Save would write it now: with its ink and filled-in form. */
  current(): Promise<Uint8Array>;
  /** Shows the changed file in place of this one, unsaved, with Undo on the notice. */
  replace(bytes: Uint8Array, message: string): Promise<void>;
  goTo(page: number): void;
  /** A password the file will be saved with, or none. */
  lock: Lock | null;
  setLock(lock: Lock | null): void;
  /** Lets the person mark places on the pages; resolves when they're done, or null if cancelled. */
  place(spec: PlaceSpec): Promise<PlacedArea[] | null>;
  organize(): void;
  /** Highlight, underline or strike the selected text, or the next text selected. */
  markText(kind: MarkKind): void;
  /** Click words on the pages to change them. */
  editText(): void;
}

export interface Lock {
  password: string;
  allow: { print: boolean; copy: boolean; edit: boolean };
}

export interface PlacedArea extends Area {
  /** Typed into the box, for text. */
  text?: string;
  /** Dragged leftward or upward on the page, for lines and arrows. */
  flipX?: boolean;
  flipY?: boolean;
}

export interface PlaceSpec {
  /** What the bar at the bottom says. */
  hint: string;
  /** Keep this width / height, for a picture or signature. */
  aspect?: number;
  /** Several boxes, finished with Done; otherwise the first box finishes. */
  multiple: boolean;
  /** A box typed into after it's drawn. */
  typing?: { size: number; color: string };
  /** How a placed box looks while placing. */
  look: "box" | "dark" | "picture" | "shape";
  picture?: string;
  /** For look "shape": which one, to draw it while placing. */
  shape?: string;
  done?: string;
}

export type Values = Record<string, unknown>;
export type Progress = (done: number, total: number) => void;

export type Field =
  | { key: string; kind: "pages"; label?: string }
  | { key: string; kind: "choice"; label: string; options: { value: string; label: string }[] }
  | { key: string; kind: "chips"; label: string; options: { value: string; label: string }[] }
  | {
      key: string;
      kind: "text";
      label: string;
      placeholder?: string;
      password?: boolean;
      lines?: boolean;
    }
  | {
      key: string;
      kind: "slider";
      label: string;
      min: number;
      max: number;
      step: number;
      format?: (v: number) => string;
    }
  | { key: string; kind: "switch"; label: string; description?: string }
  | { key: string; kind: "color"; label: string }
  | { key: string; kind: "files"; label: string; accept: "pdf" | "image"; multiple: boolean }
  | { key: string; kind: "signature"; label: string }
  | { key: string; kind: "shape"; label: string }
  | { key: string; kind: "note"; text: string };

/** The ⋮ menu's tabs, in order. */
export type GroupId =
  "pages" | "edit" | "annotate" | "convert" | "ocr" | "optimize" | "security" | "more";

export const GROUPS: { id: GroupId; title: string; icon: string }[] = [
  { id: "pages", title: "Pages", icon: "auto_stories" },
  { id: "edit", title: "Edit", icon: "edit" },
  { id: "annotate", title: "Annotate", icon: "ink_highlighter" },
  { id: "convert", title: "Convert", icon: "swap_horiz" },
  { id: "ocr", title: "OCR", icon: "document_scanner" },
  { id: "optimize", title: "Optimize", icon: "speed" },
  { id: "security", title: "Security", icon: "shield" },
  { id: "more", title: "More", icon: "more_horiz" },
];

export interface Tool {
  id: string;
  title: string;
  icon: string;
  group: GroupId;
  /** One line under the title. */
  blurb: string;
  /** Other words people search for it by. */
  keywords?: string;
  fields?: Field[];
  defaults?: Values | ((host: ToolHost) => Values | Promise<Values>);
  /** The run button's label. */
  action?: string;
  /** Runs at once when picked, with no options to set. */
  instant?: boolean;
  /** Only offered when this is true. */
  when?: (host: ToolHost) => boolean;
  /** A message for the notice; a result list for Compare; most return nothing. */
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- an async function with no return value
  run(host: ToolHost, v: Values, progress: Progress): Promise<string | Change[] | void>;
}
