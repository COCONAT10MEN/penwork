# Pivot: Penwork becomes a presentation app first (decided 2026-10-30)

**Read this before anything else in `docs/`. Where this file disagrees with an older doc, this file wins.**

## The owner's decision

Penwork v1 is now an app for **opening, presenting and making small edits to slide decks**.
The decks are written by AI (Claude chat or Claude Code) in Penwork's own file format, `.pwpptx`
(the PowerPoint name with "pw" in front: it reads as a presentation, and the prefix shows it belongs to another app).
Penwork itself is where the owner opens them, presents them with the annotation toolbar, and makes the
**small edits that aren't worth asking an AI for**: a typo, a word, a colour, a card style, slide order,
what appears on which click, a formula, a table cell, a quiz answer.

Order of work, as the owner gave it:

1. **First:** the quality of opening the app and opening a deck, plus **mini edits**.
2. **Then:** make the presentation side as complete as possible. Recreate as much of the
   Life of Physics deck experience as possible (`reference/lop-deck/`).
3. **Later (paused):** PDF viewing/annotating, notebooks, the whiteboard as its own document type, Linux,
   Android. Keep those docs and keep any finished code, but don't build or plan new work for them now.

The toolbar, settings and customisations belong to **the app**, not to each deck. A deck file is only
content. Every deck gets the same dock, the same settings and the same tools.

## Design direction

A mix of **Material 3 Expressive** (the existing kit: shapes, morphing selections, bold type, springs,
colour from a seed) and the **tinted liquid-glass** look of the owner's toolbar. The full rules are in
`docs/DESIGN-GLASS.md`, and the visual reference is `design/mockups/v2/`. This replaces the line
"No gradients, no glassmorphism" in `docs/DESIGN.md`.

## What this supersedes

| Old statement | Now |
|---|---|
| `CLAUDE.md` Scope: PDFs first, then notebooks | Decks first (see the new Scope block below) |
| `docs/ROADMAP.md` M2–M7 (PDF library, viewer, annotations, notebooks) | New M2–M7 in the same file. The old list moved to a "Paused" section |
| `docs/DESIGN.md` "No gradients, no glassmorphism" | `docs/DESIGN-GLASS.md` |
| `reference/lop-deck/HANDOFF.md` §0 and §5: "Penwork only opens PDFs, never load or present HTML decks" | **No longer true.** Penwork loads and presents decks. The rest of the handoff (toolbar behaviour §3, settings model §4, ink ideas, motion rules §3.10, lessons §8) still applies |

## What stays the same

- The stack: Tauri 2 + React + TypeScript + Vite, Motion, Material Color Utilities, our own kit in `src/ui/`.
- Everything done in M0 and M1. The M1 components gain a glass material; they are not thrown away.
- Fully offline. Nothing loads from the internet at runtime.
- Never overwrite the owner's files silently. A `.pwpptx`
  is written only on Save, through autosave to a separate recovery file, or by explicit "Save as".
- Dependency and credit rules: use well-known libraries as dependencies, never copy code in, and credit
  everything in `THIRD_PARTY.md`.
- Owner's screen: **1366×768**. Design and test at that size.
- How to work with the owner: plan first, wait for "ok", small commits, click-by-click test steps.
  **When he says "revert", restore exactly the previous state. Make only the change he asked for.
  Don't add unrequested "improvements".**

## New `CLAUDE.md` Scope block (replace the old one with this)

```md
## Scope right now (v1)

- **Platform: Windows 10/11 only.** Linux and Android come later. Keep the frontend platform-neutral.
- **Product: a presentation app.** Open `.pwpptx` decks, present them, and make small edits in the app. See `docs/PIVOT.md`.
- **Paused:** PDF viewer/annotation, notebooks, Linux, Android.
- **Input:** mouse, keyboard, touchpad, touch and stylus, exactly as the template does it. Use Pointer Events.
- **Template parity:** every feature of the owner's template stays. Nothing may be missing (`docs/TEMPLATE-PARITY.md`).
- **Design:** "Glass Expressive". Material 3 Expressive structure with tinted liquid-glass surfaces
  (`docs/DESIGN-GLASS.md`, mockups in `design/mockups/v2/`).
- Specs: `docs/DECK-FORMAT.md` (file format), `docs/EDITING.md` (mini edits),
  `docs/ARCHITECTURE-DECKS.md` (runtime, bridge, saving), `docs/ROADMAP.md` (milestones).
- The deck engine reference is `reference/lop-deck/` (the owner's own template). Port it, don't redesign it.
```

## Decisions already made (with the reason)

1. **The format is HTML slides in a zip, not a JSON slide model.** The AI already writes this slide
   vocabulary well (`reference/lop-deck/presentation-template/AI-GUIDE.md`), the Morph/step engine
   depends on it, and the owner's existing decks can be imported without loss. Mini edits work on a
   known set of components (card, list, formula…), so the editor still knows what each thing is.
2. **The slide engine runs in a sandboxed iframe.** The React app around it draws the chrome (dock, inspector,
   sorter). The two talk through a small typed message bridge. Deck content can't reach the app or
   the internet.
3. **The dock, ink, overview grid and settings are rebuilt in React** using the handoff as the behaviour spec.
   The slide engine (stage scaling, maths, Morph, steps, quiz, widgets, background blobs) is **ported** from
   the reference template, keeping its look exactly.
4. **No free-form layout editing.** Mini edits change content and the documented options. Anything structural
   is "Ask AI": copy the slide for AI, then paste the reply back.
5. **The whiteboard (W key) is in v1** (changed by the owner: every template feature stays). Only the
   whiteboard as its own document type stays paused with notebooks.

## Owner decisions after reading the pack (2026-10-30, these win over anything above)

1. **File extension:** `.pwpptx`. It isn't a PowerPoint file and PowerPoint can't open it.
2. **Every template feature stays.** Stylus, touch, custom cursors, all annotation settings and the whiteboard.
   The checklist is `docs/TEMPLATE-PARITY.md`.
3. **Logo:** the dock shows the Penwork logo. The user can replace it in Settings with their own SVG
   (requirements in `docs/DESIGN-GLASS.md` §8). It's an app setting, so decks no longer carry a dock logo.
4. **App colour is a setting, default "Sync with logo":** the default logo uses the Windows accent colour, a custom
   logo uses its own single colour. See `docs/DESIGN-GLASS.md` §4.
5. **Edits go into the file** on Save, so they travel to other devices. Ink is also kept in the file by default.
6. **One roadmap:** `docs/ROADMAP.md`.
7. **Runtime:** slides are served through a private app address, and edits work on the original HTML, not the live
   slide (`docs/ARCHITECTURE-DECKS.md`). Both follow tests of the first design (blob images and inline scripts failed).
8. **Look and speed:** blobs are still by default, Mica is out of M1, popovers start solid, Home follows the mockup
   (a "New deck" card, no FAB). When in doubt, follow the design mockup.
9. **AI kit:** must explain exactly how `.pwpptx` relates to plain HTML, so an AI knows what to write.
10. **Ink strokes use `perfect-freehand`** instead of the template's own stroke drawing. Highlighter multiply compositing stays.
11. **No raw `.html` files (2026-10-31).** Penwork never opens, imports or registers for `.html`, by any route, because raw
    HTML can cause problems and that is the reason `.pwpptx` exists. This replaces every mention of an `.html` importer.
    Paste from AI on Home is removed too (2026-10-31). A `.pwpptx` file and New deck are the only ways a deck gets in.
12. **Everything on screen says "presentation", never "deck" (2026-11-01).** The code keeps the word `deck`.
13. **Opening goes to the edit view, like PowerPoint (2026-11-01).** A show is always full screen: Present or F5 starts it,
    Esc or F ends it on the slide it stopped at, and there is no windowed show. So the template's full-screen toggle becomes
    End show. Present on Home is the one way to open straight into a show.
14. **The template comes first (2026-11-01).** M5 (dock, ink, whiteboard) moves ahead of M4 (mini edits).
15. **The dock, ink, whiteboard and grid are ported into the slide page, not rebuilt in React (2026-11-01).** This replaces
    decision 3 above. The template routes pen, finger and mouse through one page: the pen always draws while a finger
    navigates and palms are ignored. An overlay in the app can't take a pen and let a finger through, so the exact behaviour
    needs ink in the same page as the slides. The page stays sandboxed, and the app checks everything it sends.
16. **Nothing may look like a web page or like Windows (2026-11-01).** Everything is Penwork's own: glass dialogs, glass
    notices, our own right-click menu and tooltips, with Material 3 Expressive motion. WebView2's browser menus, shortcuts,
    zoom and autofill are off. Open and Save as still use the Windows file picker, and the window keeps its Windows title bar.
17. **The design is copied exactly (2026-11-01).** Teal is the default colour. The owner's later decisions still beat the mockups: "presentation", no Paste from AI, no `.html`,
    and slide numbers above each slide.
18. **The slide toolbar stays the template's (2026-11-01).** The owner asked for it back. Its look and its animation are
    the template's, with the Windows accent on black as before; only its tooltip is ours. This replaces decision 17's
    dock and the mockups' dark capsule.
19. **Motion is Google's, not lookalike (2026-11-01).** The rest of the app takes its springs and behaviour from Compose's
    source. The old "panels and menus never bounce" rule is gone; it now covers the slide toolbar alone. Liquid Glass
    supplies how the material behaves (`docs/DESIGN-GLASS.md` §6).
20. **As much of Material 3 Expressive as fits (2026-11-01).** Google's real shapes, morphing, loading indicator, FAB menu,
    split button and floating toolbar are in, made of liquid glass. These go beyond the mockups, on the owner's request.
    The toolbar's pen settings take the flower colours; the slide toolbar itself stays the template's (decision 18).
21. **Any colour on text (2026-11-02).** The owner asked for a full colour picker, so typed text can take any colour. This
    goes past the template's three text colours, and the toolbar keeps those as shortcuts.
22. **The slide page is never resized (2026-11-02).** Its frame is always the size of the screen and is only scaled and
    moved (`src/features/deck/stagePlace.ts`), because resizing a page redoes its layout. Going full screen is smooth
    in the window, then pauses at rest while Windows switches, which can't be avoided.
17. **Word, Excel and PDF files open in Penwork, on free libraries (2026-11-02).** LibreOffice was dropped as too hard to
    embed. PDF.js, docx-editor and FortuneSheet with FortuneExcel do the work, in `src/features/office/`, restyled with our
    tokens. PDF is no longer paused, and uses PDF.js's own markup and saving instead of `pdf-lib`. The presentation system
    stays ours. These libraries do less than Microsoft Office, and what's missing gets added later. Penwork does not take
    over Windows file associations for these types. The owner chooses that, not the installer.
18. **For office files, design comes first (2026-11-02).** Dark mode is for the app: pages stay white unless "Dark pages" is
    on. Every document has one floating top bar with the name, which renames the real file when edited, and the tools. Pages
    sit straight on the ambient background. Every feature stays, but less-used ones may be a click or two deeper. Tools,
    menus and pop-ups from the libraries are restyled and animated to match, and nothing stacks under the top bar.
19. **Penwork is an office suite (2026-11-02).** This replaces "a presentation app" at the top of this file. Presentations,
    documents, spreadsheets and PDFs are equal: one Files tab with a filter for each type, Favorites for all of them, and
    Home shows the last file of any type. The Presentations and Layouts tabs are gone, and starting layouts stay in New
    presentation. Word, Excel and PDF are finished first because they stand on libraries, then the presentation work carries
    on, since that is built from the ground up. Settings holds every setting, on its own tabs, and a setting gets a control
    only when it really works.
