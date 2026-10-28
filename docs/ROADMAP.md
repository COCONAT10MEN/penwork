# Roadmap — Windows v1 (notes + PDFs, mouse input)

Work top to bottom. Tick boxes as items are finished and verified in the running app.
Each milestone should end with a working, committed app.

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
- [x] Seed from the Windows accent color (Rust command), fallback to Ink blue `#3F5BD4`
- [x] Typography, shape, elevation and state-layer tokens (`docs/DESIGN.md`)
- [x] Motion presets (springs) + reduced-motion fallback
- [ ] Components in `src/ui/`: Button (filled, tonal, outlined, text; small/medium/large), IconButton (standard, filled, tonal, toggle),
      ButtonGroup (connected, shape morph on select), SplitButton, FAB, FAB menu, Chip (filter/assist), SearchBar,
      NavigationRail, TopAppBar, Card, List + ListItem, Menu, Dialog, SideSheet, Snackbar, Tooltip, Slider, Switch,
      SegmentedButton, FloatingToolbar, LinearProgress (wavy + flat), CircularProgress (wavy), LoadingIndicator (shape morph)
- [ ] A hidden "Gallery" screen (dev builds only) showing every component in light and dark
- [ ] Keyboard focus ring and hover/pressed state layers on everything interactive

## M2 — App shell & Library
- [ ] Layout: navigation rail (Library, PDFs, Notebooks, Favorites, Trash) + content, like `design/mockups/library-desktop.html`
- [ ] Open PDFs: button, drag-and-drop onto the window, "Open with" from Explorer (file association for `.pdf`), single instance
- [ ] Library: recent files, thumbnails, search, filter chips, favorites, remove from list
- [ ] "Continue" hero card for the last opened file
- [ ] FAB menu: Import PDF / New notebook / Quick note
- [ ] Settings: theme (system/light/dark), seed color picker, reduce motion, default zoom
- [ ] Remember window size/position

## M3 — PDF viewer (everything a proper viewer has)
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

## M4 — Annotations (mouse)
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

## M5 — Saving & PDF compatibility
- [ ] Save a copy / Save (overwrite asks first) writing standard PDF annotations with pdf-lib, including appearance streams
- [ ] Check saved files open correctly in Edge, Chrome and Adobe Reader (manual test list)
- [ ] "Flatten" option (burn annotations into the page)
- [ ] Import existing annotations from a PDF into the editable model (highlight, ink, free text, note, square, circle, line)
- [ ] Fill PDF forms (AcroForm text fields, checkboxes, radio, dropdown) and save
- [ ] Export annotations summary (Markdown)

## M6 — Notebooks
- [ ] `.pwk` file format (zip of JSON + assets) with a version number; save/load + tests
- [ ] Notebook editor like `design/mockups/notebook-desktop.html`: pages side sheet, floating toolbar, pen settings popover
- [ ] Page templates: blank, lined, dotted, grid, Cornell
- [ ] Mouse ink, highlighter, eraser, lasso select (move/resize/recolor), shapes, text boxes, images
- [ ] Insert PDF pages into a notebook and annotate them
- [ ] Export notebook to PDF
- [ ] Autosave + crash-safe writes (write to temp file, then rename)

## M7 — Polish & release
- [ ] Print (PDF and notebook)
- [ ] Performance pass; memory check with several large PDFs open
- [ ] Accessibility pass (keyboard-only walkthrough, screen reader labels, contrast)
- [ ] App icon (cookie-shape logo) and installer via `npm run tauri build` (NSIS)
- [ ] Error handling: corrupt PDFs, missing files, full disk
- [ ] README with screenshots

## Later (not v1)
- Stylus: pressure, tilt, palm rejection, pen-only mode
- Linux build (WebKitGTK) — test Pointer Events pressure there early
- Android build
- Handwriting search, OCR for scanned PDFs, sync
