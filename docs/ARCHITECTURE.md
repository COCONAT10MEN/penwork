# Architecture

## Big picture

```
React UI (src/)                 ← all screens, our M3E kit, pdf.js, annotation layer
   │  invoke() / events
Tauri 2 core (src-tauri/)       ← file read/write, dialogs, file associations, app-data paths,
                                  Windows accent color, single instance, window state
Windows (WebView2)
```

Keep the frontend platform-neutral. Anything OS-specific goes behind a Rust command so the
Linux/Android builds later only need new Rust code.

## Tauri plugins (expected)

`dialog` (open/save), `fs` (scoped to user-picked files + app data), `single-instance`
(open-with goes to the running window), `window-state`, `deep-link`/file associations via
`bundle.fileAssociations` for `.pdf` and `.pwk`. Ask before adding others.

Security: keep the default capability set tight. Only grant fs access to app data and to
files the user explicitly opened or saved.

## Opening a PDF

1. Rust reads the bytes (from dialog, drag-drop path, or open-with argument) and returns them.
2. Frontend computes a SHA-256 of the bytes → `docId`.
3. pdf.js loads the bytes in its worker. Page sizes are read once and cached.
4. The viewer virtualizes: only pages near the viewport get canvases; text layers likewise.
5. Sidecar annotations for `docId` load from app data and render on top.

## Coordinates (important)

- Every annotation is stored in **PDF user space** for its page: points, origin bottom-left,
  using the page's view box, **before** rotation.
- Screen ↔ PDF conversion uses pdf.js `PageViewport` (`convertToPdfPoint`, `convertToViewportPoint`).
  Wrap these in `src/lib/coords.ts` and unit-test them, including rotated pages.
- Zoom never changes stored data.

## Annotation model (sidecar JSON)

```ts
type Color = { r: number; g: number; b: number }; // 0..1, like PDF
interface AnnotationBase {
  id: string;            // uuid
  page: number;          // 0-based
  kind: 'highlight' | 'underline' | 'strikeout' | 'ink' | 'freetext'
      | 'note' | 'square' | 'circle' | 'line' | 'arrow' | 'signature';
  color: Color;
  opacity: number;       // 0..1
  createdAt: string;     // ISO
  modifiedAt: string;
  author?: string;
  contents?: string;     // comment text
  fromPdf?: { objNum: number; gen: number }; // set when imported from the file (M5)
}
// text markup: quads = 8 numbers per line box (x1,y1,x2,y2,x3,y3,x4,y4) like PDF QuadPoints
// ink: strokes = Array<Array<[x, y]>> + width
// freetext: rect + text + fontSize
// note: anchor point + contents
// square/circle/line/arrow: rect or two points + width
// signature: rect + ink strokes (or rendered text) — saved as Ink or Stamp
```

Undo/redo: every change is a command `{ do(), undo() }` pushed on a per-document stack.

Storage: `<AppData>/Penwork/annotations/<docId>.json`, written debounced (~500 ms) using
write-temp-then-rename. Include `"version": 1` at the top for future migrations.

## Saving into a PDF (M5)

- **Save a copy** (default) or **Save** (overwrite, after confirmation; keep a `.bak` the first time).
- pdf-lib low-level API creates standard annotation dictionaries:
  Highlight/Underline/StrikeOut (QuadPoints), Ink (InkList), FreeText, Text (sticky note),
  Square, Circle, Line (+ LE arrow), signatures as Ink or Stamp.
- **Always write an appearance stream (`/AP`)** so Edge, Chrome and Adobe show them the same.
- **Flatten** draws the same appearances into page content and removes the annotations.
- Annotations that came from the file (`fromPdf`) are updated in place, not duplicated.

## Notebooks (M6)

`.pwk` = zip:
```
manifest.json      { "format": "penwork-notebook", "version": 1, "title", "pages": [ids], "created", "modified" }
pages/<id>.json    { template, size, elements: [...] }   // ink, text, shape, image, pdfPage
assets/<hash>.png|.pdf
thumbs/<id>.webp
```
Elements share the same command-based undo system as PDF annotations, and reuse the same
drawing tools (ink, shapes, text) — build those tools once in `src/features/annotations/tools/`
and use them in both editors.

## Testing

- Unit tests (Vitest) for: coords, quad generation from selections, undo stack, sidecar read/write,
  `.pwk` read/write, theme generation.
- Manual test checklist per milestone in the PR/commit description.
- Keep a few test PDFs in `test-files/` (tiny, public-domain): rotated pages, password, forms, 500 pages
  (generated), existing annotations.
