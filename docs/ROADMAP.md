# Roadmap: Penwork presentations (Windows)

Penwork is a presentation app first (`docs/PIVOT.md`). Work top to bottom.
Each milestone ends with a working, committed app, `/check` green, the ui-reviewer agent run, and click-by-click test steps.
Tick boxes only when finished and verified in the running app.

## M0 — Project scaffold & tooling
- [x] Scaffold Tauri 2 + React + TypeScript + Vite into this repo root (keep existing docs, `.claude/`, `CLAUDE.md`, `design/`)
- [x] App identifier `com.penwork.app`, window title "Penwork", min window size 960×640
- [x] Scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `tauri`
- [x] ESLint + Prettier configured; TypeScript strict
- [x] Vitest set up with one passing example test
- [x] Folder layout from `CLAUDE.md` created
- [x] Roboto Flex, Caveat and Material Symbols Rounded bundled locally (no CDN)
- [x] `THIRD_PARTY.md` filled in for everything installed
- [x] `git init`, first commit; `npm run tauri dev` opens an empty window

## M1 — Theme & Material 3 Expressive component kit
- [x] Theme generation from a seed color with material-color-utilities → CSS variables (light + dark)
- [x] Follow system light/dark; manual override in settings later (M2)
- [x] Seed from the Windows accent color (Rust command), now a Settings choice; teal `#00687A` is the default
- [x] Typography, shape, elevation and state-layer tokens (`docs/DESIGN.md`)
- [x] Motion presets (springs) + reduced-motion fallback
- [x] Components in `src/ui/`: Button (filled, tonal, outlined, text; small/medium/large), IconButton (standard, filled, tonal, toggle),
      ButtonGroup (connected, shape morph on select), SplitButton, FAB, FAB menu, Chip (filter/assist), SearchBar,
      NavigationRail, TopAppBar, Card, List + ListItem, Menu, Dialog, SideSheet, Tooltip, Slider, Switch,
      SegmentedButton, FloatingToolbar, LinearProgress (wavy + flat), CircularProgress (wavy), LoadingIndicator (shape morph)
- [x] A hidden "Gallery" screen (dev builds only) showing every component in light and dark
- [x] Keyboard focus ring and hover/pressed state layers on everything interactive

### M1 additions: Glass Expressive
- [x] `Surface` primitive: `material="glass" | "tonal"`, `strength="thin|regular|thick"` (`docs/DESIGN-GLASS.md`)
- [x] Glass tokens generated per theme (light + dark), Transparency setting (Glass / Reduced) wired up
- [x] No-bounce spring preset (ratio 1.0) for dock, panels, popovers and menus
- [x] Existing components take `material`: Card, Menu, Dialog, NavigationRail, TopAppBar, SearchBar, Tooltip
- [x] Remaining components: SideSheet, SplitButton, FloatingToolbar (generic capsule container), LinearProgress (wavy + flat),
      CircularProgress (wavy), LoadingIndicator, **ColorPicker** (SV square, hue, hex, live preview), **TextField**, **Breadcrumb**
- [x] Expressive shapes in `src/ui/shapes.ts` (cookie, clover) + the cookie app logo
- [x] Ambient background (still blobs by default; `docs/DESIGN-GLASS.md` §3)
- [x] Gallery shows every component in glass and tonal, light and dark, over the ambient background
- [x] Measure the FloatingToolbar opening and idle GPU load on the laptop, and report both

## M2: Home & opening a deck (quality first)
- [x] **First: prove the runtime.** Sandboxed iframe on the private app address shows slide 1 of the demo with its images, and deck
      code can't reach Tauri commands (tested in the real app). Everything below that shows a slide depends on this
- [x] Home like `design/mockups/v2/home.html`: rail, search, "Good evening", Continue card, drop zone, recent decks, "New deck" card
- [x] First launch window fits 1366×768 (≈90% work area, centred); remember size/position/maximised
- [x] `.pwpptx` reader/writer + manifest schema validation + tests (`docs/DECK-FORMAT.md`)
- [x] Sanitiser (DOMPurify + our rules) with tests, and a "Cleaned up while opening" note
- Removed by the owner (2026-10-31): opening raw `.html` files, and Paste from AI on Home. A `.pwpptx` file and New deck are the ways in
- [x] Open by button, drag-and-drop, double-click in Explorer (file association `.pwpptx`), single instance
- [ ] The Open with menu in File Explorer (uses the same launch as double-click; the owner confirms it by hand)
- [x] Library storage (recents, favourites, last slide), thumbnails cached, search + filter chips, remove from recents
- [ ] Startup feels instant: measure cold start to Home and "open deck to first slide" on the laptop, report both.
      Measured 2026-10-31 on the installed app: Home in about 2 s (1.0–2.1 s), first launch after installing 3.7 s;
      8-slide deck to first slide 64 ms. The owner decides whether that feels instant
- [x] Settings screen (glass): theme, app colour (sync with logo / match deck / custom), custom logo (SVG, `docs/DESIGN-GLASS.md` §8),
      logo background, transparency, reduce motion
- [x] Test decks in `test-files/`: the demo deck (.pwpptx), a broken zip, a deck with a widget

## M3: Slide runtime & Present
- [x] Opening a presentation lands in the edit view, like PowerPoint: slide list, big slide, Present button (owner, 2026-11-01)
- [x] Runtime ported from `reference/lop-deck/deck-template.html` into `src/runtime/` (engine only, no dock/ink)
- [x] Typed bridge, including forwarded keys (`docs/ARCHITECTURE-DECKS.md`). Pointer events stay in the page, with the ink (PIVOT decision 15)
- [x] **Parity test**: 8 demo slides match the original template (`npm run test:parity`, using the Edge on Windows)
- [x] `docs/TEMPLATE-PARITY.md` §1 and §2 all ticked: slide engine and navigation input, including clicker use
- [x] Present mode: fullscreen, steps, Morph, quiz, widgets, maths. F5 from the start, Shift+F5 from the current slide, Esc or F ends it
- [x] Hidden slides skipped; last slide → back to cover (template behaviour) or stop (setting)
- [x] Dock: the template's full dock replaces the planned minimal shell (see M5)
- [x] Overview grid: `docs/TEMPLATE-PARITY.md` §8
- [x] Remember last slide per deck; "Continue" on Home opens there

## M4: Mini edits (`docs/EDITING.md`)
**Comes after M5** (owner, 2026-11-01): every template feature first.
- [ ] Edit mode layout like `design/mockups/v2/edit.html`: top bar, sorter, stage, inspector
- [ ] Selection model (hover, click, deeper/up, Tab), breadcrumb, type tag, step numbers
- [ ] Inline text editing + context toolbar (bold, italic, orange, teal, muted, clear, insert formula)
- [ ] Inspector for every component in `EDITING.md` (slide, title, card, list, formula with live preview, table, columns,
      diagram, image, worked example, quiz, recap, cover)
- [ ] Steps: appears on click, animation, together with previous, highlight part. Steps sub-mode
- [x] Sorter: add from layout gallery, duplicate, delete, hide, reorder, multi-select, copy/paste between decks
- [ ] Deck settings: brand values propagate to every slide, accent colours, language/direction
- [x] Undo/redo (command stack), Ctrl+S atomic save, recovery autosave + recover on launch, unsaved dot
- [ ] Deck doctor (overflow + bad formula) chips and inspector warnings
- [ ] Ask AI: Copy slide/deck for AI, Paste reply with preview (replace / insert)
- [ ] **Authoring kit** in `authoring/` (`AI-GUIDE.md`, `pwpptx.py`, example, `PROMPT.md`) + Settings → "Get the AI kit".
      It explains exactly how `.pwpptx` relates to plain HTML

## M5: Dock, ink & whiteboard (everything in the template)
- [ ] `docs/TEMPLATE-PARITY.md` §3–§7 and §9–§11 all ticked. **Not a single feature may be missing**
- [ ] Input devices: stylus (pressure, barrel button, eraser end), touch, palm rejection, tablet mode, tool-shaped cursors
- [x] Dock, every tool and its settings, colour picker, ink with undo/redo and animations
- [ ] The selection slides between tools as one shape (DESIGN-GLASS §6), and the toolbar gets arrow keys
- [x] Whiteboard with all backgrounds
- [x] Toolbar settings, including Export/Import compatible with files from the template, validated on load
- [ ] Ink kept in the deck by default (done, on Save), setting to keep it on this device only (Part 4 of M4); ink drawn on overview thumbnails (done)
- [x] Every popover tested in the real WebView2 window (handoff §8 blanking bug)
- [ ] Tested with a real stylus and touch, if the owner has the hardware; otherwise say so plainly

## M6: Presentation complete
- [ ] Presenter view on a second monitor (current, next, notes, timer, step dots)
- [ ] Export PDF (one page per slide fully revealed, or per step) and print
- [ ] Export a standalone `.html` (the old template engine + this deck) for sharing with students
- [ ] Blackout (B / . while presenting; B keeps opening the picker on the whiteboard), `?` shortcut sheet, clicker edge cases
- [ ] Layout gallery and "New deck" templates polished; deck themes (accent presets)

## M7: Polish & release
- [ ] Performance pass on the laptop (60 fps dock/Home, memory with 3 decks open)
- [ ] Accessibility pass (keyboard-only, labels, contrast on glass)
- [ ] App icon, `.pwpptx` file icon, installer (NSIS) via `npm run tauri build`
- [ ] Error handling: corrupt decks, missing assets, full disk, newer format version
- [ ] README with screenshots
- [ ] (Optional) Mica on Windows 11, only if it proves worthwhile

## Paused (PDFs & notebooks, not v1)
Kept unchanged for later, unticked. Also paused: Linux, Android, the whiteboard as its own document type,
handwriting search, OCR, sync. Stylus extras beyond the template (tilt, pen-only mode) come later too.

### Old M2 — App shell & Library
- [ ] Layout: navigation rail (Library, PDFs, Notebooks, Favorites, Trash) + content, like `design/mockups/library-desktop.html`
- [ ] Open PDFs: button, drag-and-drop onto the window, "Open with" from Explorer (file association for `.pdf`), single instance
- [ ] Library: recent files, thumbnails, search, filter chips, favorites, remove from list
- [ ] "Continue" hero card for the last opened file
- [ ] FAB menu: Import PDF / New notebook / Quick note
- [ ] Settings: theme (system/light/dark), seed color picker, reduce motion, default zoom
- [ ] Remember window size/position

### Old M3 — PDF viewer (everything a proper viewer has)
- [ ] Render with pdf.js in a worker; continuous vertical scroll; only visible pages ± 2 rendered
- [ ] Crisp at any zoom (re-render on zoom settle; use devicePixelRatio)
- [ ] Zoom: Ctrl + wheel, Ctrl +/−, touchpad pinch, fit width, fit page, actual size; zoom around the cursor
- [ ] Page navigation: page box, PgUp/PgDn, Home/End, go to page
- [ ] Thumbnails side sheet; outline/bookmarks panel; clickable internal and external links (external ask first)
- [ ] Text selection and copy (text layer)
- [ ] Find (Ctrl+F): next/previous, match count, highlight all, match case
- [ ] Rotate view (per page / all); two-page and single-page modes
- [ ] Dark-page mode (invert pages for night reading)
- [ ] Password-protected PDFs (ask for password)
- [ ] Remember last page and zoom per file
- [ ] Show existing annotations from the PDF (pdf.js annotation layer)
- [ ] Tabs or quick switching between several open PDFs
- [ ] Smooth with a 500-page PDF (test file noted in the PR)

### Old M4 — Annotations (mouse)
- [ ] Annotation model in PDF coordinates (`docs/ARCHITECTURE.md`) + undo/redo (Ctrl+Z / Ctrl+Y)
- [ ] Floating toolbar like `design/mockups/pdf-desktop.html`
- [ ] Highlight / underline / strikethrough from selected text; also free-box highlight for scanned PDFs
- [ ] Freehand ink with the mouse (perfect-freehand), color + thickness
- [ ] Shapes: rectangle, ellipse, line, arrow
- [ ] Text box (free text) with font size and color
- [ ] Sticky-note comments with a reply/edit popover
- [ ] Signature: draw with mouse or type it; save signatures for reuse; place and resize
- [ ] Eraser (whole annotation); select, move, resize, delete, change color
- [ ] Annotations side sheet: list, filter (all/marks/ink/comments), click to jump
- [ ] Autosave annotations to the sidecar store; restore when the file is reopened

### Old M5 — Saving & PDF compatibility
- [ ] Save a copy / Save (overwrite asks first) writing standard PDF annotations with pdf-lib, including appearance streams
- [ ] Check saved files open correctly in Edge, Chrome and Adobe Reader (manual test list)
- [ ] "Flatten" option (burn annotations into the page)
- [ ] Import existing annotations from a PDF into the editable model (highlight, ink, free text, note, square, circle, line)
- [ ] Fill PDF forms (AcroForm text fields, checkboxes, radio, dropdown) and save
- [ ] Export annotations summary (Markdown)

### Old M6 — Notebooks
- [ ] `.pwk` file format (zip of JSON + assets) with a version number; save/load + tests
- [ ] Notebook editor like `design/mockups/notebook-desktop.html`: pages side sheet, floating toolbar, pen settings popover
- [ ] Page templates: blank, lined, dotted, grid, Cornell
- [ ] Mouse ink, highlighter, eraser, lasso select (move/resize/recolor), shapes, text boxes, images
- [ ] Insert PDF pages into a notebook and annotate them
- [ ] Export notebook to PDF
- [ ] Autosave + crash-safe writes (write to temp file, then rename)

### Old M7 — Polish & release
- [ ] Print (PDF and notebook)
- [ ] Performance pass; memory check with several large PDFs open
- [ ] Accessibility pass (keyboard-only walkthrough, screen reader labels, contrast)
- [ ] App icon (cookie-shape logo) and installer via `npm run tauri build` (NSIS)
- [ ] Error handling: corrupt PDFs, missing files, full disk
- [ ] README with screenshots
