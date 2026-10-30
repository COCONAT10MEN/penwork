# Architecture: decks, runtime, editing, saving

```
React app (src/)                          Slide runtime (src/runtime/, its own bundle)
├─ Home, Settings, Edit chrome, Dock      ├─ ported LoP engine: stage scaling, mini-LaTeX,
├─ Deck store (Zustand) + undo stack      │  Morph transitions, steps (st), background blobs,
├─ Ink overlay (canvas over the iframe)   │  quiz, widgets (W.*), data-hl highlighting
└─ Bridge (typed postMessage)  ◄───────►  └─ Edit helpers: hit-testing, inline editing, mapping to source
          │
Tauri core (src-tauri/): open/save dialogs, read/write zip bytes, file associations (.pwpptx, open-with),
single instance, window state/fullscreen, Mica, accent colour, app-data paths, recovery files
```

## 1. Slide runtime

- **Where it comes from:** `reference/lop-deck/deck-template.html`. Port the engine CSS and the engine script **minus**
  the dock/ink/overview/whiteboard code (`reference/lop-deck/source/toolbar-ink-overview.js`), which the React app
  rebuilds. Keep behaviour and look identical. TypeScript with light typing is fine. Don't redesign it.
- **How it runs:** an `<iframe sandbox="allow-scripts">` (no `allow-same-origin`) that loads the slide page from a
  **private Tauri address** (custom URI scheme, for example `penwork-deck://`). Rust serves the runtime, `theme.css`, sanitised
  `slides.html`, `widgets.js` and assets as separate responses, streamed from the zip, each with this CSP header:
  `default-src 'none'; script-src <scheme>:; style-src <scheme>: 'unsafe-inline'; img-src <scheme>: data:; font-src <scheme>: data:`.
  The fonts the engine names are system fonts on Windows (Segoe UI, Cambria Math).
- **Why not `srcdoc` and blob URLs (tested in Chromium 152):** a `srcdoc` page inherits the app's CSP, so deck scripts don't
  run at all, and loosening that would weaken the whole app. Blob images fail in a sandboxed iframe. Separate files also stop
  a `theme.css` from closing its `<style>` tag and running a script. **The first task of M2 proves this design works,**
  including that deck code can't reach Tauri commands (test that in the real app).
- **Parity test (acceptance):** the 8 demo slides rendered by Penwork match the original template's rendering
  (Playwright screenshots of both, fully revealed, at 1920×1080, small pixel tolerance). Keep this test in the repo.

## 2. Bridge (both directions, versioned, validated)

App → runtime: `load(deck)`, `go(slideIndex, step)`, `next()`, `prev()`, `setMode('present'|'edit'|'steps')`,
`select(path)`, `applyEdit(op)`, `serialize(slideId)`, `measureOverflow(slideId)`, `thumbnail(slideId)`.

Runtime → app: `ready`, `state({slide, step, steps, total})`, `selection({path, kind, rect, props})`,
`textCommitted({slideId, path, text})`, `overflow({slideId, problems})`, `key(event)`, `pointer(event)`, `error`.

Keys and pointer events are forwarded because a focused iframe swallows them: Esc, F, the arrows and Ctrl+S must work
wherever focus is, and the ink overlay needs to know what is under a pen (TEMPLATE-PARITY §3).

Every message has `{v:1, id, type, payload}`. Check `event.source === iframe.contentWindow` and validate the
payload shape. Ignore anything else. **Treat everything from the iframe as untrusted:** `widgets.js` shares the page with the
runtime, so it can forge any runtime message.

## 3. Deck model & undo

- Zustand store per open deck: `manifest`, ordered `slides: {id, html, hidden}`, `theme`, `widgets`, `notes`,
  `assets` (name → blob/hash), `dirty`, `fileHandle/path`.
- Edits are **commands** `{label, do(), undo()}` that store before/after HTML for the slides they touch. Typing in one
  editing session merges into one command. The undo history holds 200 commands per deck.
- **The store's original HTML is the source of truth, and edits never read HTML back from the running slide.** The engine
  changes the live DOM: it replaces formula source with rendered HTML, removes the `tex` class, splits text into `.w` word
  spans and adds state classes. So the app applies each edit to the original HTML (parsed with `DOMParser`, no scripts run),
  sanitises the result, makes it a command, and sends the changed slide back to the runtime. The runtime is only for showing
  the slide, hit-testing and the inline editing box.

## 4. Ink (milestone M5)

- An overlay canvas above the iframe in the React app, positioned and scaled exactly like the stage (1920×1080 units).
- Strokes are stored in stage units per slide id (format in `DECK-FORMAT.md` §6), with per-slide snapshot history
  (max 60), highlighter multiply compositing, and a laser trail that is never stored. See handoff §3.7.
- Kept **in the deck** (`ink.json`) by default, so it travels with the file. With "Keep ink in the deck" off, it stays in app
  data `<AppData>/Penwork/ink/<deckId>.json` (deckId = a uuid stored in the manifest on first save).
- The whiteboard's ink uses the key `wb` in the same store.

## 5. Thumbnails

- Sorter, overview grid and Home need thumbnails. Prefer **live scaled clones** inside the runtime for the sorter and
  grid (exact, always current). For Home cards, rasterise the first slide (or last viewed slide) to PNG once and
  cache it under `thumbs/` in app data, keyed by slide id + content hash. Choose the rasteriser in the M2 plan
  (for example `modern-screenshot` inside the iframe, or the WebView capture API) and say why.

## 6. Windows

- One main window. Present = Tauri fullscreen on the current monitor. Esc leaves fullscreen, a second Esc leaves Present.
- First launch: about 90% of the work area, centred (the owner's screen is 1366×768). After that, remember size,
  position and maximised state.
- Later (M6): presenter view in a second window on the second monitor (current slide, next slide, notes, timer).

## 7. Files & safety

- File associations: `.pwpptx` opens in Penwork (icon from the cookie logo). "Open with" for `.html` offers Import.
- Single instance: a second launch hands its file path to the running window.
- Atomic saves and recovery files: `DECK-FORMAT.md` §8.
- Library (recents, favourites, last slide per deck, cached thumbnail path) in `<AppData>/Penwork/library.json`, written temp-then-rename.
  "Remove from recents" never touches the deck file.
- Capabilities: fs access only to app data and to files the user opened or saved through dialogs, drag-drop or open-with.
