# Handoff: the annotation toolbar idea → Penwork

> **Note (2026-10-30):** parts of this were written before the pivot. Penwork now loads and presents decks, and uses the glass look.
> `docs/PIVOT.md` wins wherever this disagrees, and `docs/TEMPLATE-PARITY.md` lists every feature to keep. Kept here as written.
> Files it calls `reference/...` now sit directly in this folder (`reference/lop-deck/`).

**Audience:** the AI that is building Penwork (Tauri 2 + React + TypeScript, Material 3 Expressive).
**Written:** 2026-10-30, by a different AI session that built this toolbar for a classroom-presentation template.
**Your job:** read this, look at the screenshots, open `reference/deck-template.html` in a browser, then decide
**what changes to Penwork's plan** (roadmap, components, state, file format) are worth making. Do not port this blindly.

---

## 0 · What the owner actually wants (read first)

* Penwork opens **PDF files**. That is all. It is **not** a presentation app and **not** a browser.
  Nothing from this package that loads, builds or plays HTML slide decks belongs in Penwork.
* What he wants from this work is **the idea of the annotation toolbar** — the way it looks, behaves and feels —
  and the lessons learned building it, so Penwork's annotation tools (roadmap **M4**), its **FloatingToolbar**
  component (M1 part 2), its **Settings** screen (M2 part 2) and later **notebooks** (M6) can be designed with it in mind.
* He stopped Penwork mid-way to finish this toolbar first. Penwork's status (from his own report): M0 done,
  M1 in progress (5 of 8 boxes), M2 not started. **Don't derail M1/M2 for this** — slot it where it naturally fits.
* I have **not seen the Penwork repo or the mockups** (`design/mockups/`), only the project report. Anything below
  about "how this maps onto Penwork" is a proposal to be checked against `docs/ARCHITECTURE.md`, `docs/DESIGN.md`,
  `docs/ROADMAP.md` and `CLAUDE.md`. Where they disagree with me, **they win**.
* Standing owner preferences you should respect: no secrets in zips (only `.env.example`); equations in properly rendered
  math notation, never flat text; fully offline; original PDFs never silently modified; owner's screen is **1366×768**
  (the screenshots here are captured at that size on purpose).

---

## 1 · What was built (the one-paragraph idea)

A **floating, collapsible annotation dock**. At rest it is a single round **logo button** that fades and sinks half-way
off the screen edge. Tap it and it **grows into one capsule** that contains tool buttons:
**pointer · pen · highlighter · laser pointer · eraser | undo · redo · clear · show/hide ink | whiteboard · all-pages grid · full screen**.
Drawing happens on canvas layers over the content. Every tool has **its own settings** (colour presets + saved custom
colours + a colour picker, size presets + slider, pressure, highlighter strength, laser trail length). Tapping a selected
tool again opens that tool's settings popover. Right-clicking / long-pressing the logo opens **toolbar settings**
(layout, position, orientation, which buttons exist and in what order, gestures, touch mode). Ink is stored per page, has
undo/redo history per page, and every add/remove of ink and of toolbar buttons is **animated**.

Look at `reference/screenshots/` first (10 images, 1366×768):

| File | Shows |
|---|---|
| `01-logo-closed` | the resting state: only the logo |
| `02-toolbar-open` | logo + toolbar as one capsule |
| `03-pen-and-highlighter-ink` | red pen stroke + highlighter stroke on content |
| `04-tool-settings-popover` | the pen's own settings popover |
| `05-colour-picker` | the colour picker popup beside it |
| `06-toolbar-settings` / `07-…-scrolled` | toolbar settings (behaviour, layout, gestures, button list) |
| `08-whiteboard` | endless scrolling whiteboard mode |
| `09-overview-grid` | all-slides overview with the annotations drawn on thumbnails |
| `10-vertical-toolbar` | vertical orientation, docked to a side |

The **visual style is a dark glass look with a cyan accent from the Life of Physics logo.** Penwork should NOT copy
that look; it should be restyled in Material 3 Expressive using `src/ui/` tokens. Keep the *structure and behaviour*.

---

## 2 · What is in this package

```
penwork-handoff/
├─ HANDOFF.md                      ← this file
├─ README.md                       ← 30-second orientation
└─ reference/
   ├─ deck-template.html           ← WORKING DEMO. Double-click it (Chrome/Edge). Tap the logo (bottom centre).
   ├─ screenshots/                 ← 10 PNGs described above
   ├─ settings-example.json        ← exactly what the toolbar persists (see §6)
   ├─ source/
   │  ├─ toolbar-ink-overview.js   ← ALL toolbar / ink / popover / whiteboard / overview logic (≈1300 lines, plain JS, no deps)
   │  └─ deck-and-toolbar.css      ← the stylesheet (≈540 lines; toolbar rules are the appended blocks at the end)
   └─ presentation-template/       ← the original deliverable this came from (context only; see §9)
```

How to explore the demo: open `reference/deck-template.html`; press **→** to move between slides; tap the logo;
pick the pen; draw; tap the pen again for its settings; right-click the logo for toolbar settings; press **G** for the grid,
**W** for the whiteboard, **Ctrl+Z / Ctrl+Y** undo/redo.

Source map for `toolbar-ink-overview.js` (line numbers are for that file):

| Lines | What |
|---|---|
| 4–35 | `IC` icon set (24×24 SVG path strings) and `ic(name)` |
| 36–61 | tool list, colour presets `COL`, size presets `SZ`, ranges `RNG`, `defCfg()` per-tool defaults, `ITEMS` (button catalogue), `ORDER_DEF`, `defUI()` |
| 63–94 | `fixAll()` (validates / clamps loaded settings), `loadSettings()`, `saveSettings()` |
| 110–163 | `btnHTML`, `mainList`, `fillMain` — **keyed reconcile of the toolbar with animated add/remove** |
| 165–225 | `collapse()` (width/height collapse animation helper), `syncDock`, `renderDock` |
| 232–257 | auto-dim, sink-into-edge timer (`armSink`), `toggleDock`, `setTool`, `setAnnot` |
| 258–377 | ink data, canvas layers, stroke smoothing/drawing, highlighter compositing, history, **ink fade/appear effects** (`inkFx`, `swapInk`), `undo/redo/clearInk` |
| 378–424 | eraser (hit-testing strokes) and laser (fading trail) |
| 426–450 | **tool-shaped OS cursor** built from an SVG data-URL |
| 452–594 | input routing: pen vs mouse vs touch, pointer capture, gestures |
| 595–637 | dock click/context-menu handling, tool tap logic |
| 639–787 | overview grid (thumbnails, ink on thumbnails, open/close morph) |
| 788–831 | keyboard shortcuts |
| 832–900 | whiteboard (endless, backgrounds) and background picker |
| 901–1108 | popover system (`placePop`, `popAnim`, `follow`), custom slider, **tool settings popover**, **colour picker** |
| 1109–1200 | **toolbar settings popover**, export/import JSON |
| 1201–1243 | whiteboard scrolling/inertia |
| 1244–1293 | movable dock (drag the logo, snap to corner/edge) + init |

The code is a **single-scope script that depends on the host deck** for a few globals — `cur` (current slide index), `N`,
`go()`, `next()/prev()`, `scaleF` (stage scale), `REDUCED`, `EASE/OUT`, `annot`. Those are the seams you replace with
Penwork's own state (current page, zoom, reduced-motion setting). See §7.

---

## 3 · Behaviour specification

### 3.1 The logo and the capsule
* **Closed:** only a circular logo button. After `sinkDelay` seconds (2/4/8, default 4) of no interaction it **fades and sinks
  half-way off the nearest screen edge** (`sink` setting). Hover/touch brings it back instantly.
* **Tap logo:** the logo and the toolbar become **one capsule** (one continuous shape, never two pieces that "separate" at the
  end of the animation — this was an explicit owner complaint, fixed by scaling the glass/rim with one animated CSS
  property `--wf`). The logo changes colour (dark → accent) as it opens. Tap again to close.
* **Drag logo:** moves the whole dock; on release it **snaps** to one of 6 positions (`br bc bl tr tc tl`; in vertical mode
  the centre positions become the side-centres). Position is saved.
* **Right-click / long-press logo:** opens toolbar settings. (Guard: ignore a right-click that arrives <1 s after settings
  were opened, otherwise Windows fires open+close.)
* **Orientation:** horizontal or vertical (`vert`). All collapse animations switch axis (width ↔ height).
* **Start open** (`open`) lets the dock start expanded.

### 3.2 The buttons
Catalogue (`ITEMS`): `ptr, pen, hl, laser, eraser | undo, redo, clear, hide | wb, grid, full`.
Groups `t` (tools), `e` (edit), `v` (view); a thin **separator** is drawn between groups. `full` is meant to be last.
* **Pointer** = "navigate, don't draw". Tools are armed only when a tool button is active; mouse draws only while armed.
* **Undo / redo** per page. **Clear** removes the page's ink (animated sweep) and is itself undoable. **Hide ink** fades all
  ink out/in (opacity+blur) without deleting it.
* **Whiteboard** swaps content for an endless blank board (see 3.6). While in whiteboard mode the pointer, hide-ink and
  grid buttons collapse away and a **board-background** button collapses in.
* **Grid** = overview of all pages with ink drawn on the thumbnails.
* **Button visibility / order** are user settings (§3.5). **Hiding or showing a button animates**: the button shrinks
  (width, or height when vertical) + fades while its neighbours slide in; showing is the reverse. Separators animate
  too. Implementation = keyed reconcile (`fillMain`) instead of rebuilding `innerHTML`, so state/focus/hover survive
  and fast toggle-flip-toggle works (an exiting button can be revived mid-animation).

### 3.3 Tool tap logic (important, owner iterated on this)
* First tap on a tool → **select** it (and arm annotation).
* **Tap a selected tool again** → open **that tool's settings popover** (toggle `tapAgain`).
* **Double-tap** a tool → select + open its settings (toggle `dbl`).
* **Right-click** a tool → open its settings; long-press does the same on touch (toggle `rclick`).
* These three gestures are each switchable in settings ("Tool gestures").
* The popover is anchored to the tool's button and follows it; opening another popover closes the first.

### 3.4 Per-tool settings (nothing is shared between tools)
Defaults live in `defCfg()`:
* **Pen:** colour, width (3 presets 4/8/15 + slider 1–40), **pressure** on/off (stroke width follows pen pressure), up to 3 saved custom colours.
* **Highlighter:** colour, width (26/38/54, slider 10–90), **opacity ("strength")** 0.15–0.85 stored **per stroke** — old strokes keep the strength they were drawn with.
* **Laser:** colour, size, **trail life** (300–4000 ms); it leaves a fading trail, never stored as ink.
* **Eraser:** size only (10–160). Erases by hit-testing whole strokes' geometry under the eraser radius.
* **Colours:** 4 presets per tool + up to 3 **saved custom colours** ("Save to my colours" in the picker) + the **picker popup**
  (saturation/value square, hue slider, hex text field, live preview). The picker is a *separate popup* beside the
  tool popover, not inside it. There is **no eyedropper**.
* Popover shows a **live preview** of the stroke and a **Reset** for that tool.

### 3.5 Toolbar settings popover (right-click/long-press logo)
Sections: **Behaviour** (start open, auto-hide, hide-after 2/4/8 s, starting tool) · **Layout** (orientation, 6-position grid) ·
**Touch** (tablet mode auto/on/off) · **Tool gestures** (the 3 toggles) · **Buttons** (reorder up/down + show/hide per button)
· **Settings file** (Export / Import JSON) · **Reset all**. Changes apply and save instantly.
* **Tablet mode** = bigger buttons/sliders/switches (class `tab` on `<html>`). Penwork targets mouse/keyboard first, stylus later:
  keep the idea, drive it from Penwork's own touch/stylus setting.

### 3.6 Whiteboard
Endless vertically-scrolling blank board; ink is stored under its own key (`wb`); background pattern (blank, dots, squares,
ruled, graph paper) and colour (white, cream, blackboard, green…) chosen from a small popup (key **B**). Scroll by wheel/keys with
inertia + a thin scroll indicator. **For Penwork this is the seed of notebooks (M6).**

### 3.7 Ink engine (what actually draws)
* Strokes are arrays of points `[x, y, pressure]` plus style: `{k:'p'|'h', c, w, op, np, pts}`.
* **Four stacked canvases**: `cHL` (committed highlights), `cHLv` (live highlight), `cPen` (committed pen), `cLive` (live). Pen canvas uses
  `desynchronized:true` for low latency.
* Pen smoothing = midpoint quadratic curves; width = `w*(.4+1.2*pressure)`. **Penwork should use `perfect-freehand`** (already in your stack) instead.
* **Highlighter trick:** each stroke is painted opaque onto a scratch canvas (so its own overlaps never darken), then
  composited onto the highlight layer with `globalCompositeOperation='multiply'` at the stroke's own opacity. This gives
  marker-like overlap behaviour and **keeps the text underneath readable** — keep this technique for PDFs.
* Canvases are DPR-aware; ink is stored in **content coordinates** (here the 1920×1080 stage) and re-transformed on resize.
* **History:** per-page arrays of snapshots (max 60) + redo stack. Operations are snapshot-based (`swapInk`), which also
  drives the animations: removed strokes are repainted on a throw-away canvas and faded/swept out (clear = mask sweep);
  added strokes (undo of clear, redo) fade in. Undo/redo/clear/hide also give the button a small wiggle.
* **Cursor:** while a tool is armed the *real OS cursor* is replaced by a tool-shaped SVG data-URL (round dot for pen sized to the
  stroke, square for highlighter, glow for laser, ring for eraser). Zero lag because it is the OS cursor, not a DOM element.
  Lesson: because pointer capture is on `<html>`, the cursor must be set on **both `body` and `documentElement`**, or it
  reverts to the default while a button is pressed.
* **Input routing:** pen/stylus draws, finger navigates (swipe), mouse draws only when armed. Stylus barrel button / eraser end erases.
  Pointer capture is taken on drawing start. `inUI()` ignores events inside dock/popovers.

### 3.8 Overview grid
Real thumbnails of every page (slides fully revealed) with the annotations painted on top (`.tinkw` canvas), a
selection ring, keyboard navigation, and an **open/close morph** (the chosen thumbnail grows to the full page). Thumbnails are
built lazily at idle and **refreshed when the grid opens** if the page changed. For Penwork this maps to a **page-thumbnail
sidebar/grid** and reuses the thumbnails the library already caches.

### 3.9 Keyboard (all already implemented)
`→ ↓ PageDown Space Enter` next · `← ↑ PageUp Backspace` back · `Home/End` · `P` pen · `H` highlighter · `L` laser · `E` eraser ·
`C` clear · `A` toggle annotation · `Ctrl+Z` undo · `Ctrl+Y` / `Ctrl+Shift+Z` redo · `G` grid · `W` whiteboard · `B` board background ·
`F` full screen · `Esc` close popover → leave annotation. Not implemented yet but discussed: `?` shortcut cheat-sheet, `B`/`.` blackout
(presentation-only), clicker edge cases.

### 3.10 Motion rules the owner cares about
* **One body:** logo + toolbar must morph as a single object; no pieces fading separately, no detached slivers, no bounce.
* **No tilt, equal frame thickness** around the capsule.
* Everything shares one timing/easing pair (CSS vars `--tD/--tE`); respects `prefers-reduced-motion` (`REDUCED`) → changes become instant.
* Popovers never cover the dock (`placePop` clamps `maxHeight`; `follow()` re-places a popover for ~700 ms while the dock moves).

---

## 4 · Settings model (exactly what is persisted)

See `reference/settings-example.json`. Shape (`v:1`):

```jsonc
{ "v":1,
  "ui":{ "order":["ptr","pen","hl","laser","eraser","undo","redo","clear","hide","wb","grid","full"],
         "hidden":[], "tool":"pen", "open":false, "sink":true, "sinkDelay":4,
         "tablet":"on",            // "auto" | "on" | "off"
         "vert":false, "pos":"bc", // br bc bl tr tc tl (centre becomes side-centre when vertical)
         "tapAgain":true, "dbl":true, "rclick":true },
  "tools":{ "pen":{"c":"#e5352b","w":8,"press":true,"cust":[]},
            "hl":{"c":"#ffe14a","w":38,"op":0.42,"cust":[]},
            "laser":{"c":"#ff2b2b","w":18,"life":1500,"cust":[]},
            "eraser":{"w":50} } }
```
`fixAll()` validates everything on load (unknown ids dropped, missing ids appended, numbers clamped, hex colours checked,
custom colours capped at 3, vertical forbids a centre position). **Port this validate-on-load habit.** In the demo it lives in
`localStorage` key `lop-settings1`, with optional `window.LOP_DEFAULTS` as shipped defaults and Export/Import as a JSON file.
In Penwork this becomes part of the existing app-data settings JSON (same temp-then-rename write rule as the library).

---

## 5 · What to take, what to leave

**Take (as design + behaviour):**
1. Collapsible dock with logo → capsule morph, sink-into-edge, drag-to-snap positions, vertical mode.
2. Tool-per-settings model with tap-again / double-tap / right-click gestures (each toggleable).
3. Colour model: 4 presets + 3 saved custom + picker popup; size presets + slider; per-stroke highlighter strength.
4. Ink architecture ideas: per-page strokes, snapshot history (cap 60), animated clear/undo/redo, highlighter-multiply compositing,
   tool-shaped OS cursor, hide-ink toggle, laser trail that is never stored.
5. Keyed toolbar reconcile with animated add/remove; settings validation on load; Export/Import settings.
6. Overview grid with ink on thumbnails (page grid), endless whiteboard (→ notebooks).
7. Motion principles in §3.10.

**Leave (it is deck-specific):**
the slide engine (Morph transitions, `st` step reveals, 1920×1080 stage scaling), quiz/widgets/math (`tex`) markup, the deck
builder/checker scripts, the Life of Physics logo and cyan palette, glass look, the `localStorage` persistence, anything that
builds or plays HTML. **Penwork must never load or present HTML decks.**

---

## 6 · How it maps onto Penwork (proposal — verify against your own docs)

| In this demo | In Penwork |
|---|---|
| Slide `cur` index, `N` | current PDF page index, page count |
| 1920×1080 stage + `scaleF` | page viewport in pdf.js: **store ink in PDF user-space coordinates (points, origin per page)** so it survives zoom/rotation/resize; re-project on render |
| `ink[k]` per slide | `ink[pageIndex]` per PDF, held in **Zustand**, persisted as a **sidecar** (JSON next to the library entry in app data) — originals untouched |
| Four ink canvases over the slide | one canvas overlay per visible page (or one per viewport); same layer roles (committed pen / committed highlight / live) |
| Pen smoothing code | `perfect-freehand` outlines (pressure-aware) |
| Highlighter `multiply` composite | same on screen; for **saving into the PDF (M5)**, write highlighter as a real PDF highlight/ink annotation or flatten with blend mode Multiply via pdf-lib |
| `localStorage` settings | Penwork settings file in app data (existing Settings, M2 part 2) |
| Whiteboard | **Notebook page** (M6): endless/blank page type with background patterns |
| Overview grid | Page thumbnail grid/sidebar reusing the library's cached page-1 thumbnail approach (M2/M3) |
| Full-screen button | Tauri window API (`setFullscreen`) |
| Dock + popovers (hand-written DOM) | `src/ui/FloatingToolbar` (M1 part 2 already lists it) + Menu/Dialog/Slider/Switch/SegmentedButton from your kit; colour picker needs one new component |
| Custom range slider | your existing `Slider` |
| `REDUCED` | your reduce-motion setting; `Motion` spring presets instead of hand-tuned WAAPI easing |

"Annotations saved separately; only go into the PDF on Save / Save a copy" already matches how this demo treats ink (ink is
data first, pixels second). That is the main architectural point to carry over.

**Roadmap suggestions (yours to accept or reject):**
* **M1 part 2:** build `FloatingToolbar` as a *container* component (logo-button + capsule + collapse animation + position/snap);
  keep it generic so M4 fills it with tools. Add the colour-picker popup as a component in the Gallery.
* **M2 part 2 (Settings):** reserve space for annotation-toolbar settings (position, orientation, gestures) — or defer them to M4. Not both.
* **M4 Annotations:** this package is the behavioural spec for pen / highlighter / eraser / undo-redo / hide ink / per-tool settings.
  Laser pointer and whiteboard are optional extras; notebooks (M6) is where the whiteboard idea belongs.
* **M5:** flatten or export annotations to the PDF; sidecar format must be stable by then.

---

## 7 · Replacing the host seams (if you port code instead of re-implementing)

The source assumes a deck host. Globals to supply or rewrite: `cur`, `N`, `go(i,dir,fromEnd,quick)`, `next()`, `prev()`, `scaleF`,
`REDUCED`, `EASE`, `OUT`, `annot`, plus DOM ids `#stage #dock #ov #toast #inkwrap #wb`. Strongly consider **re-implementing in
React/TS** against Penwork's tokens rather than lifting the plain-JS file; use the file as an executable specification.
Everything is in one closure with no dependencies, which makes behaviour easy to read but not directly reusable.

---

## 8 · Known issues, lessons, honest caveats

* **Unconfirmed bug (relevant: Penwork also runs on WebView2 / Chromium on Windows):** on the owner's Windows machine,
  toggling switches in the toolbar-settings popover made the popover appear to blank/break. Could **not** be reproduced in
  headless Chromium. Mitigations applied (labels `position:relative`, `overflow:clip` on the popover, no keyboard focus on
  mousedown, scroll reset, no `backdrop-filter` on popovers, solid popup backgrounds, custom scrollbar). The owner was asked to
  retest; **result unknown**. Avoid `backdrop-filter` on popovers and test in the real WebView2 window.
* Right-click on the logo sometimes opened-then-closed settings on Windows (`contextmenu` fires with mouseup) → guarded by the 1 s rule above.
* A CSS class called `.st` is used by the deck engine for step reveals — never reuse generic class names in the host.
* Owner temperament note: when he says "revert", restore *exactly* the previous state; make **only the literal change asked**. Adding "improvements"
  (a medallion circle behind the logo) annoyed him more than anything else in this project.
* Thumbnails/overview: a slide's DOM can change (quiz answered, slider moved) → refresh thumbnails when the grid opens.
* Verified in headless Chromium with Playwright (frame sampling by pausing WAAPI animations at fixed times). **Not verified** in WebView2,
  with a real stylus, on touch hardware, or on Linux/Android.
* Not built: PDF export of annotations, persistent ink across reloads (ink is in memory only in the demo), first-run tour, `?` cheat-sheet.

---

## 9 · `reference/presentation-template/` (context only)

The original deliverable: `deck-template.html` (engine + 8-slide demo), `example-slides.html`, `build_deck.py`, `check_deck.py`,
`AI-GUIDE.md` (how another AI writes slides for it; its §9 documents the toolbar from the user's side). It is **not part of Penwork**
and is included only so you can see how the toolbar was originally specified and consumed. `build_deck.py example-slides.html out.html`
+ `check_deck.py out.html` were run against this exact template: 8 slides, 0 overflow, no console errors.

---

## 10 · Decisions that are yours (with my lean)

1. **Port code or re-implement?** Re-implement in React/TS; treat the JS file as a spec. (Lean: re-implement.)
2. **Coordinate space for ink:** PDF points per page. (Lean: yes, essential for zoom/rotate.)
3. **Where does the toolbar live — floating dock or Material 3 `FloatingToolbar`?** The floating, draggable, collapsible
   dock is the owner's liked design; M3's FloatingToolbar can be the visual skin. (Lean: M3 skin + this behaviour.)
4. **Highlighter on save:** real PDF highlight annotation vs flattened ink. (Lean: real annotation for text-aligned marks, ink for freehand.)
5. **Laser + whiteboard in v1?** Laser is cheap; whiteboard overlaps notebooks. (Lean: laser optional, whiteboard folded into M6.)
6. **Persistence format** for the sidecar (JSON of strokes per page, versioned, written temp-then-rename). Must be in the plan before M4 starts.
7. **Open decisions already in the Penwork report** (default colour style, FAB menu look) are unrelated to this package — don't conflate.

---

## 11 · Paste-ready prompt for the receiving AI

> Read `HANDOFF.md` and look at the 10 screenshots in `reference/screenshots/`. Open `reference/deck-template.html` in a browser and try
> the toolbar. Penwork only opens PDFs — ignore everything slide-/HTML-related. Compare the toolbar's behaviour (§3), settings model (§4) and
> ink architecture against Penwork's `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md` and `CLAUDE.md`. Produce a **short change
> proposal**: (a) edits to the roadmap for M1 part 2 / M2 / M4 / M5 / M6, (b) new components for `src/ui/`, (c) the stroke + sidecar data format,
> (d) the settings keys to add, (e) risks (WebView2 testing, pdf.js coordinates). Do **not** start coding until the owner approves the proposal,
> and do not interrupt the current M1 work to do this.
