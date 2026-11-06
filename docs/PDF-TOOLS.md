# PDF tools (PDF part 3)

The owner's decision (2026-11-03): every PDF tool people need, recreated from iLovePDF's list, so a PDF never has to
leave the app. Time is the point: a tool must be quicker than finding the file, uploading it, converting it,
downloading it and opening it.

## Where they are

- The ⋮ at the end of the PDF's bar opens a glass sheet: the kinds of tools down its side (Pages, Edit, Shapes,
  Convert, OCR, Optimize, Security, More, and Settings at its foot), each kind's tools as tiles, and search across
  all of them. The rail and what's beside it scroll each on their own; only the side with the tools shows a bar,
  the app's own.
- Settings there are the PDF's own (Dark pages, view, Editing, the annotation toolbar), taking effect at
  once; a toolbar button switched off folds away as it does in a show.
- Text selected on a page glows in the app's colour and gets a small bar just above it: Bold, Italic, Underline,
  Strikethrough, Monospace, Copy. They show at once, with no reload, and toggle like any formatting bar (pressed
  again on the same words, the style comes off; bold then italic is both). Pressed beside the words, a selection
  starts at the nearest one, as in other readers.
- The highlighter's own settings choose Freehand, Text (snaps to words, a rounded box per line) or Area (a rounded
  box with its own pointer).
- **Editing** (Settings ▸ View) covers everything that changes what's on the pages: the pens, the Edit and Shapes
  tools, and styling selected text. Off, the pens fold out of the bar, the Edit and Shapes tabs say editing is off
  (with a button to turn it on), and the selection bar offers only Copy. What's on the pages stays. Pages,
  Convert, OCR, Optimize, Security and More don't need it.
- **One undo history.** The toolbar's Undo and Redo, Ctrl+Z and Ctrl+Y (on the page or in the app's bar), and Undo
  on a notice all go through one history for the whole PDF, in the order things were done: ink, text styles, and
  every tool that changes this PDF. The toolbar keeps it (`engine.js`); the app's steps go in by id
  (`useEditHistory.ts`), and a tool's step keeps the file from before it and after it.
- `src/features/pdftools/registry.ts` lists the entries. One entry is one more item; it doesn't have to be a tool.
- A tool's options show in the same sheet; tools with nothing to choose run as soon as they're picked.
- Word and spreadsheets: Save ▸ Save as PDF in their bar.
- The annotation toolbar's settings are in Home ▸ Settings (PDF and Presentations tabs), not on the work screen.

## How they work

- **In place, unsaved.** Tools that change this PDF show the result at once, as a step in the PDF's undo history.
  The file is written only on Save, like every edit (the version Save replaced is kept in `before-save`).
- **New files beside it.** Tools that make files (split, extract, convert) write them next to the PDF, never over
  another file ("name (2).pdf"), several at once into a new folder. The notice offers Open and Show in folder.
- **Off the app's thread.** pdf-lib and qpdf run in a worker (`worker.ts`), so the window never stops responding;
  long tools show a live count.
- **Offline.** qpdf (WebAssembly) and Tesseract with its English and Arabic data ship with the app
  (`scripts/copy-pdfjs.mjs`); nothing is fetched.
- **The pure parts are tested** in `src/lib/pdftools/` (pages, stamps, flatten, remove watermark, crop, details,
  OCR text, pictures, text layout).

## Tools

| Kind | Tools |
|---|---|
| Pages | Organize (drag, turn, copy, delete, blank, extract), Merge, Split, Extract, Remove, Rotate, Add blank pages, Reverse, Remove blank pages |
| Edit | Edit text, Add text (any language), Add picture, Sign (draw, type, picture), Watermark, Remove watermark, Page numbers, Crop, Form fields, Redact |
| Shapes | Rectangle, rounded, oval, triangles, diamond, pentagon, hexagon, star, heart, speech bubble, tick, cross, line, arrow, double arrow |
| Convert | PDF to Word, Excel, PowerPoint, text, Markdown; Export as images (one picture, a folder, a zip, or a picture-only PDF); Extract images; Pictures to PDF |
| OCR | OCR (English, Arabic), Extract text (scanned pages read too; saved and copied) |
| Optimize | Compress, Repair, Flatten |
| Security | Protect with a password, Remove password |
| More | Compare, File details, Show in folder |

Passwords: a PDF with one asks for it when opened (our own dialog), opens through qpdf, and is saved with it again
unless Remove password was used. A PDF with only restrictions opens straight away, and Save writes it without them.
A PDF that won't open offers Repair.

## How some of them are done

- **Remove watermark** removes what the file marks as a watermark (watermark annotations, `/Artifact` sections of
  subtype Watermark, optional-content layers named watermark). Penwork's own watermarks are marked that way. A
  watermark drawn as plain page content can't be told apart from the page and stays; the notice says so.
- **Edit text** paints over the old words in the paper's most common colour around them and writes the new ones
  at the same size, in the same kind of type (sans, serif or mono) and ink colour. The old words stay in the file
  under the paint, so they can still be found by searching; Redact removes words for good.
- **Text styles** (`textStyles.ts`) are kept beside the file while it's open and drawn over the pages
  (`textStyleLayer.ts`, an SVG per page in the page's own units, so zooming needs nothing). They're written in
  when the file is: on Save, or when a tool reads it. Bold, italic and monospace paint over the old words in the
  paper's colour and write them again in the bold, italic or Courier face of their own kind of type, fitted to
  their old width; underline and strike through are the PDF's own text-markup annotations.
- **Highlight, underline and strikethrough** are the PDF's own text-markup annotations, with appearances, so any
  reader shows them and can remove them.
- **Redact** turns the marked pages into pictures of themselves with the areas blacked out, so the text is gone
  from the file. OCR afterwards makes them searchable again.
- **OCR** writes invisible text over the page with a font-free ("glyphless") font, as OCRmyPDF does, so any
  language works without shipping its font.
- **Text that the PDF's built-in font can't show** (Arabic, for one) goes in as a sharp picture of itself.
- **PDF to PowerPoint** makes each page a slide picture, with the page's text in the notes.
- **Word / Excel to PDF** prints a copy of the pages through WebView2's own print-to-PDF.

## Left out, and why

- HTML to PDF: Penwork never opens `.html` (CLAUDE.md).
- Translate and AI Summarizer: they need an online AI, and the app works offline.
- Scan to PDF: a phone feature, for when Android comes.
- PDF/A: no permissively licensed tool makes a certified PDF/A offline.
- PowerPoint (.pptx) to PDF: Penwork doesn't open .pptx files.
