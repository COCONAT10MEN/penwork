# Penwork — project instructions for Claude Code

Penwork is a desktop app for **opening, presenting and making small edits to slide decks**, styled as
**Glass Expressive** (Material 3 Expressive with tinted liquid glass). "Penwork" is a working name.
Read `docs/PIVOT.md` first: where it disagrees with an older doc, it wins.

## Scope right now (v1)

- **Platform: Windows 10/11 only.** Linux and Android come later. Keep the frontend platform-neutral.
- **Product: a presentation app.** Open `.pwpptx` decks, present them, and make small edits in the app. See `docs/PIVOT.md`.
- **Office files:** Word (`.docx`), Excel (`.xlsx`, `.csv`) and PDF open in `src/features/office/`, on free libraries. See decision 17 in `docs/PIVOT.md`.
- **Paused:** notebooks, Linux, Android.
- **Input:** mouse, keyboard, touchpad, touch and stylus, exactly as the template does it. Use Pointer Events.
- **Template parity:** every feature of the owner's template stays. Nothing may be missing (`docs/TEMPLATE-PARITY.md`).
- **Design:** "Glass Expressive". Material 3 Expressive structure with tinted liquid-glass surfaces
  (`docs/DESIGN-GLASS.md`, mockups in `design/mockups/v2/`).
- Specs: `docs/DECK-FORMAT.md` (file format), `docs/EDITING.md` (mini edits),
  `docs/ARCHITECTURE-DECKS.md` (runtime, bridge, saving), `docs/ROADMAP.md` (milestones).
- The deck engine reference is `reference/lop-deck/` (the owner's own template). Port it, don't redesign it.

## Stack (decided — ask before changing)

| Layer | Choice |
|---|---|
| Shell | Tauri 2 (Rust), WebView2 on Windows |
| UI | React 18+ + TypeScript (strict) + Vite |
| State | Zustand (one store per open document + an app store) |
| Motion | `motion` (motion/react) with spring presets from `docs/DESIGN.md` |
| Slides | The owner's template engine ported to `src/runtime/`, in a sandboxed iframe |
| Deck files | `.pwpptx` = zip of HTML slides + assets (`docs/DECK-FORMAT.md`) |
| Sanitising | DOMPurify + our rules |
| PDF | `pdfjs-dist` (pdf.js): its viewer shows, finds and marks up PDFs, and writes the marks on Save |
| Word | `@docx-editor.dev/react` + `core` (the free packages only, never `pro`) |
| Excel, CSV | `@fortune-sheet/react` + `@corbe30/fortune-excel` + `exceljs` |
| Ink smoothing | `perfect-freehand` |
| Color | `@material/material-color-utilities` — generates the theme from a seed color |
| Icons | Material Symbols Rounded (bundled locally, not from a CDN) |
| Fonts | Roboto Flex (UI) + Caveat (handwriting demo text) — bundled locally |
| Notebook files (paused) | `.pwk` = zip (via `fflate`) of JSON + assets |
| Tests | Vitest (unit), Playwright later for e2e |

The app must work **fully offline**. Never load scripts, fonts or icons from the internet at runtime.

## Dependencies and credit

- Prefer a well-known open-source library over writing a complex thing from scratch
  (PDF parsing, color math, zip, smoothing). Use it as a normal npm/cargo dependency — never copy its code in.
  The one exception is the owner's own template in `reference/lop-deck/`: port that engine, don't redesign it.
- Every runtime dependency gets a row in `THIRD_PARTY.md` (name, author, license, what we use it for).
- Only permissive licenses (MIT, Apache-2.0, BSD, ISC, OFL for fonts). Ask before adding anything GPL/AGPL
  or anything with a paid "pro" tier.
- Ask before adding a dependency that is large or overlaps one we already have.

## Design rules (full spec in `docs/DESIGN.md` and `docs/DESIGN-GLASS.md`)

- Follow Material 3 **Expressive**: bold type, big rounded shapes, tonal surfaces, floating toolbars,
  FAB menu, button groups with shape morphing, spring motion.
- Google's official Material web components are in maintenance mode and won't get Expressive,
  so **we build our own small component kit** in `src/ui/`. Don't add MUI, Material Web, or other UI kits.
- **Never hard-code colors.** Use the CSS variables from `src/theme/` (`--md-sys-color-*`).
  Same for shape (`--md-sys-shape-*`), type (`--md-sys-typescale-*`) and motion presets.
- Light and dark themes are both required for every screen.
- Respect "reduce motion": springs become simple fades.
- Accessibility: real `<button>`s, visible focus ring, labels on icon buttons, 4.5:1 text contrast,
  targets ≥ 40px (48px for primary actions), full keyboard use.
- Visual reference: `design/mockups/v2/*.html` (open in a browser). When in doubt, follow the mockup. Match their layout and feel;
  the token values in `src/theme/` win if a mockup's hard-coded color disagrees.

## Code conventions

- TypeScript strict, no `any` unless commented why. Functional React components + hooks.
- Folder layout (create as needed):
  - `src/ui/` — design-system components only (no app logic)
  - `src/theme/` — tokens, theme generation, motion presets
  - `src/features/library/`, `src/features/pdf/`, `src/features/annotations/`, `src/features/notebook/`
  - `src/lib/` — pure helpers (geometry, coordinate transforms, file formats) — unit-test these
  - `src-tauri/` — Rust: file access, dialogs, open-with/file associations, app data paths
- **Deck ink:** store strokes in stage units (1920×1080) per slide, never in screen pixels.
- **Say "presentation" to the user, never "deck".** Every word on screen. `deck` stays in code, file names and `.pwpptx`.
- **Our own design for everything:** nothing may look like a web page or like Windows. Dialogs, notices, right-click menus
  and tooltips are all glass with spring motion. Tell the user things with `src/features/notices/notices.ts`.
  See `docs/PIVOT.md` decision 16.
- **No raw `.html` files.** Penwork never opens, imports or registers for `.html`; that is why `.pwpptx` exists.
- **Never overwrite the owner's files silently.** A `.pwpptx` is written only on
  Save or Save as; autosave goes to a separate recovery file.
- **Office screens:** design comes first (decision 18 in `docs/PIVOT.md`). One top bar, pages on the ambient background, white pages unless "Dark pages" is on.
- **Office files:** written only on Save or Save as. The version Save replaced is kept in the app's `before-save` folder,
  because the libraries don't keep everything a file can hold. After `npm install` of anything these use, run `npm run licenses`.
- **Paused with PDFs:** the next three rules apply if our own PDF annotation work resumes.
- **PDF coordinates:** store every annotation in PDF user-space points (origin bottom-left, from the page's
  viewBox), never in screen pixels. Convert only when drawing. Helpers live in `src/lib/coords.ts` with tests.
- **Never modify the user's original PDF silently.** Annotations autosave to a sidecar in the app data folder
  (keyed by file hash). Writing into a PDF only happens on Save / Save a copy (see `docs/ARCHITECTURE.md`).
- Large PDFs (500+ pages) must stay smooth: render only visible pages ± 2, cancel off-screen renders,
  reuse canvases, run pdf.js in its worker.
- Keep components small. If a file passes ~300 lines, split it.
- Comments explain *why*, not *what*.

## Commands

```bash
npm run tauri dev      # run the app (hot reload)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm test               # vitest run
npm run tauri build    # Windows installer (later milestones)
cd src-tauri && cargo check
```

Use `/check` to run all checks, `/milestone <n>` to work on a roadmap milestone.

## How to work in this repo

1. Work one milestone at a time from `docs/ROADMAP.md`. For anything bigger than a small fix,
   show a short plan first and wait for "ok".
2. Make small commits with clear messages after each working step, then `git push`. Never force-push.
   A Stop hook (`.claude/hooks/auto-commit.sh`) auto-commits and pushes anything left over at the
   end of each turn, but prefer your own descriptive commits.
3. Before saying something is done: run `/check`, then run the app and describe what you checked.
   If you could not check something visually, say so plainly.
4. After finishing a milestone item, tick its checkbox in `docs/ROADMAP.md`.
5. The owner is learning — explain decisions in plain language and keep answers short.
   When something needs a manual test, give exact click-by-click steps.
6. Ask before: changing the stack, adding big dependencies, changing file formats, deleting files.
7. When the owner says "revert", restore exactly the previous state. Make only the change asked for, with no unrequested "improvements".
8. **Every template feature stays.** Check work against `docs/TEMPLATE-PARITY.md`; nothing on it may be missing.

## Secrets

There are no secrets in this project. Never create or commit `.env` files with real values —
only `.env.example`. Never read `.env` files.
