# The slide toolbar on PDFs (PDF part 2)

The owner's decision (2026-11-03): pdf.js's own highlight, draw and text tools go. PDFs get the presentation's
toolbar: the same dock, look and timing, the same pen settings, and the same rules for pen, finger and mouse.
This file says how, so it stays the same however long the work takes.

## One engine, two modes

The toolbar and its ink live in `src/runtime/engine.js`. It is shared, never copied: PDFs run the same file with a
**document mode** switched on. Everything new in the engine sits behind that switch, so a presentation runs exactly as
before. The template parity tests and the presentation checks prove it after every change.

What document mode changes in the engine:

- No slides. Every PDF page is a "slide" for ink: it has its own ink list, undo and redo, keyed `p<number>`.
- Units: a page is 1920 units wide, like the stage, so pen sizes look the same as on a slide. Its height follows the
  page's shape. The host converts to PDF points (origin bottom-left) at the bridge, so everything outside the engine
  keeps the PDF rule in `CLAUDE.md`.
- Several pages are on screen at once: ink is drawn page by page, each with its own transform and clip. A stroke
  belongs to the page it started on.
- The host tells the engine where every visible page is after each scroll or zoom, in the same frame.
- Tools that only make sense for slides are left out of the dock: All slides, the whiteboard, and swipes or taps to
  change slide. End show becomes leaving full screen. Clear this slide becomes Clear this page.
- The arrow keys and Space scroll the PDF; they don't change slides.

## One surface

The PDF's pages and the engine share one document, a same-origin page served by the app (not the sandboxed slide
origin: there is no untrusted content in it). That is what lets the engine's pointer rules work as they do in a show:
the pen always draws, a finger scrolls and pinches, the mouse draws only with a tool picked, and with the pointer tool
the text can still be selected and links followed. The React app still owns the bar, zoom, side panel and find, and
drives pdf.js inside that page directly.

## The toolbar is part of the top bar

The owner's decisions (2026-11-03): no copies of the tools in the app's bar, no logo and no Annotate button. The
presentation's own tools are always out, as part of the bar: first in its row of tools, before Pages and contents.

- The page fills the whole window, under the bar too. It draws the bar's glass itself (`#pwband`), so the tools sit in
  that glass instead of floating over it. The app's bar above it turns see-through: only its buttons are drawn and
  take the pointer, and everywhere else reaches the tools.
- The tools are styled as the bar's own buttons (no pill, frame or logo), with the presentation's icons, pen colours,
  tool settings and gestures. The tool in use is a solid circle in the primary colour.
- The app keeps a seat for them in its row of tools, as wide as they are, and tells the page where it is
  (`--pw-dock-left`) in the same frame whenever anything in the bar moves (`useDockSeat`).
- When the PDF opens the tools arrive one after another, and the bar's reading tools carry the same wave on.
- Left out on a PDF: All slides, the whiteboard, End show, and Show / hide ink (the ink is always shown). The
  toolbar settings open with a right-click (long-press on touch) on the Pointer, without the layout settings.
- In a narrow window the name gives up room first, then the page arrows, zoom's − and + and Find's width step aside,
  and the tools get a little smaller, so nothing overlaps down to 1024 px.
- Hiding the bar while reading takes the glass and the toolbar up with it, on the same spring.
- With the page under the bar, the pointer's position in the page is the window's, so ink lands under the pointer
  (inside an offset frame, WebView2's raw pointer updates reported window positions; document mode doesn't use them).

## Saving

- On Save, each page's ink is written into the PDF as real ink annotations, with appearance streams, so Edge, Acrobat
  and phone readers show it. The highlighter is written with its strength and multiply blending, as it looks on screen.
- Penwork marks its own annotations. On opening, those are taken out of the copy pdf.js shows and handed back to the
  engine as editable ink, so they never show twice. Other annotations in the file are left alone.
- `pdf-lib` (MIT) writes the annotations. Unsaved ink goes to a recovery copy like presentations, never into the file.

## Order of work

1. The shared page: pdf.js pages and the engine in one same-origin document, driven by the React app.
2. Document mode in the engine: dock, per-page ink, drawing at any scroll and zoom.
3. Saving and reopening as PDF ink annotations.
4. Remove pdf.js's editors, then test: pen, highlighter, laser, eraser, undo, redo, clear, hide, with mouse, pen and
   touch, on a 500-page PDF, and the full presentation suite.
