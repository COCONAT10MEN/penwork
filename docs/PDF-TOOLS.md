# PDF tools (PDF part 3)

The owner's decision (2026-11-03): every PDF tool people need, recreated from iLovePDF's list, so a PDF never has to
leave the app. Time is the point: a tool must be quicker than finding the file, uploading it, converting it,
downloading it and opening it.

## Where they are

- The ⋮ at the end of the PDF's bar opens a glass sheet: Search, then the kinds of tools down its side (Pages,
  Edit, Shapes, Convert, OCR, Optimize, Security, More, and Settings at its foot), each kind's tools as tiles
  with their names only.
- **Search** (Ctrl+F, on the page or anywhere in the app) is the PDF's only find: the bar has none. One field finds
  text in the PDF (Match case, Whole words), tools and settings. Text results are listed by page with the words
  around them; picking one goes to it, highlighted in the app's colour, and Enter / Shift+Enter or F3 step
  through them. It's pdf.js's own find underneath (`usePdfSearch.ts`), read out for the list. Closing the sheet
  clears the highlights. A setting found opens Settings at its row, lit up for a moment.
- **Shapes** is one tab: colour, line width and fill at the top, the shapes under them. Picking a shape starts
  drawing it. The rail and what's beside it scroll each on their own; only the side with the tools shows a bar,
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

- **Live, with no reload.** Edits to what's on the pages (styled words, Edit text, Add text, pictures, signatures,
  shapes, watermarks, page numbers) are kept beside the file and drawn over the pages (`pageEdits.ts`,
  `pageEditLayer.ts`), so they show the moment they're made; Undo and Redo are instant too. They're written in
  on Save, or when a tool reads the file. Tools that change the file's structure still show their result as a
  new file: page tools, Crop (page sizes), Redact (pages become pictures), Remove watermark (rewrites the
  page), Form fields (the form), Optimize and Security. Every change is a step in the PDF's undo history.
  The file is written only on Save (the version Save replaced is kept in `before-save`).
- **The words' own font.** Edit text and the selection bar read which font words are set in from the PDF
  itself (`runFont.ts`: pdf.js keeps each font's file, whose name table holds the original name) and find
  the same font installed on Windows (`fontMatch.ts`, from the registry's list through a Rust command that
  reads only fonts on that list). New words go on the old baseline, at the old size and colour, with the
  old spacing between letters, drawn in that font on screen and embedded in the file (only the letters
  used) on Save. A font that isn't installed, or a font collection (.ttc), falls back to the closest
  built-in kind. Bold on words already bold in the file takes the bold off, as in Word.
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

- **Organize pages** opens on a page of its own over the app's background (above the PDF and its bar), with
  a bar like the document's: Cancel, the title and how many pages are picked, Rotate, Duplicate, Insert blank
  page, Extract, Delete, and Done.
- **Merge** is a list in the order the pages will go, this PDF in it too: each with its first page, name and
  page count, dragged by its handle or moved with the arrows. This PDF stays the base (its bookmarks and form
  come along) and the others go before and after it.
- **Split**: Single pages, Equal parts (a number with − and +) or Ranges (a row a file, from and to with − and
  +, Add range), with the files it will make shown as chips.
- **Pages** in any tool ("Some"): the pages as thumbnails to click (Shift+click for a run), All and None, and
  the same pages typed as ranges if that's quicker; the two stay in step.
- **Remove watermark** removes what the file marks as a watermark (watermark annotations, `/Artifact` sections of
  subtype Watermark, optional-content layers named watermark). Penwork's own watermarks are marked that way. A
  watermark drawn as plain page content can't be told apart from the page and stays; the notice says so.
- **Edit text** works as in Acrobat: click words and they open in place, in their own font, size and colour;
  Enter keeps the change. It paints over the old words in the paper's most common colour around them and
  writes the new ones in their font on their baseline. The old words stay in the file under the paint, so they
  can still be found by searching; Redact removes words for good.
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
- **Converting** reads each page's layout back from where its words and pictures are (`pageLayout.ts`,
  `pageRead.ts`): paragraphs with each run's own font, size, weight, slant and colour, alignment, indents,
  spacing and line height; headings by size; tables where words line up row after row; text in two columns
  read column by column; pictures cut out where they sit.
  - **Word**: a Word page per PDF page at the same size and margins, real paragraphs that wrap, Word headings
    and tables, the pictures in place, two columns as Word's own columns. A scanned page stays its picture.
  - **PowerPoint**: the text is editable text boxes in its own font, size and colour, over the page's drawing
    with the text painted out.
  - **Excel**: tables as rows and columns with a bold header; money, percentages and separated numbers as
    numbers with their format.
  - **Markdown** and **text**: in reading order, with headings, bold and italic, lists and tables.
  - Drawings made of lines and shapes (charts, diagrams) aren't carried over yet, except inside pictures.
- **OCR** reads in Tesseract's "all the text" mode: its page layout mode takes ruled tables for pictures and
  skips them. Each word sits on its line's own baseline, at the line's size, so lines read whole again.
- **Word / Excel to PDF** prints a copy of the pages through WebView2's own print-to-PDF.

## Left out, and why

- HTML to PDF: Penwork never opens `.html` (CLAUDE.md).
- Translate and AI Summarizer: they need an online AI, and the app works offline.
- Scan to PDF: a phone feature, for when Android comes.
- PDF/A: no permissively licensed tool makes a certified PDF/A offline.
- PowerPoint (.pptx) to PDF: Penwork doesn't open .pptx files.
