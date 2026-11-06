# PDF tools (PDF part 3)

The owner's decision (2026-11-03): every PDF tool people need, recreated from iLovePDF's list, so a PDF never has to
leave the app. Time is the point: a tool must be quicker than finding the file, uploading it, converting it,
downloading it and opening it.

## Where they are

- The ⋮ at the end of the PDF's bar opens a glass sheet: the kinds of tools down its side (Pages, Edit, Annotate,
  Convert, OCR, Optimize, Security, More), each kind's tools as tiles, and search across all of them.
- Text selected on a page gets a small bar over it: Highlight, Underline, Strikethrough, Copy.
- The highlighter's own settings (tap it again, double-tap or right-click) have "Highlight an area": a drag then
  makes a box instead of a stroke, saved into PDFs as a filled box like any highlight.
- `src/features/pdftools/registry.ts` lists the entries. One entry is one more item; it doesn't have to be a tool.
- A tool's options show in the same sheet; tools with nothing to choose run as soon as they're picked.
- Word and spreadsheets: Save ▸ Save as PDF in their bar.
- The annotation toolbar's settings are in Home ▸ Settings (PDF and Presentations tabs), not on the work screen.

## How they work

- **In place, unsaved.** Tools that change this PDF show the result at once, with Undo on the notice. The file is
  written only on Save, like every edit (the version Save replaced is kept in `before-save`).
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
| Annotate | Shapes (rectangle, rounded, oval, triangles, diamond, pentagon, hexagon, star, heart, speech bubble, tick, cross, line, arrow, double arrow), Highlight text, Underline, Strikethrough |
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
