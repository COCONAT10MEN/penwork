# Penwork — project instructions for Claude Code

Penwork is a desktop app for **reading and annotating PDFs and taking notes**, styled with
**Material 3 Expressive** (Material You). "Penwork" is a working name.

## Scope right now (v1)

- **Platform: Windows 10/11 only.** Linux and Android come later — don't add platform code for them yet,
  but don't do anything that would block them (no Windows-only UI tricks in the frontend).
- **Features: PDFs first, then notebooks.** Follow `docs/ROADMAP.md` milestone by milestone.
- **Input: mouse, keyboard and touchpad only.** There is no stylus yet.
  - Use **Pointer Events** for all drawing so pen support can be added later without rewrites.
  - Do NOT read `pressure`/`tilt` yet. Stroke width comes from the tool setting (optionally thinned by speed).
- Out of scope for now: documents, spreadsheets, slides, cloud sync, accounts, collaboration.

## Stack (decided — ask before changing)

| Layer | Choice |
|---|---|
| Shell | Tauri 2 (Rust), WebView2 on Windows |
| UI | React 18+ + TypeScript (strict) + Vite |
| State | Zustand (one store per open document + an app store) |
| Motion | `motion` (motion/react) with spring presets from `docs/DESIGN.md` |
| PDF render | `pdfjs-dist` (pdf.js) — canvas + text layer + annotation layer |
| PDF save | `pdf-lib` — writes real PDF annotations into a copy |
| Ink smoothing | `perfect-freehand` |
| Color | `@material/material-color-utilities` — generates the theme from a seed color |
| Icons | Material Symbols Rounded (bundled locally, not from a CDN) |
| Fonts | Roboto Flex (UI) + Caveat (handwriting demo text) — bundled locally |
| Notebook files | `.pwk` = zip (via `fflate`) of JSON + assets |
| Tests | Vitest (unit), Playwright later for e2e |

The app must work **fully offline**. Never load scripts, fonts or icons from the internet at runtime.

## Dependencies and credit

- Prefer a well-known open-source library over writing a complex thing from scratch
  (PDF parsing, color math, zip, smoothing). Use it as a normal npm/cargo dependency — never copy its code in.
- Every runtime dependency gets a row in `THIRD_PARTY.md` (name, author, license, what we use it for).
- Only permissive licenses (MIT, Apache-2.0, BSD, ISC, OFL for fonts). Ask before adding anything GPL/AGPL
  or anything with a paid "pro" tier.
- Ask before adding a dependency that is large or overlaps one we already have.

## Design rules (full spec in `docs/DESIGN.md`)

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
- Visual reference: `design/mockups/*.html` (open in a browser). Match their layout and feel;
  the token values in `src/theme/` win if a mockup's hard-coded color disagrees.

## Code conventions

- TypeScript strict, no `any` unless commented why. Functional React components + hooks.
- Folder layout (create as needed):
  - `src/ui/` — design-system components only (no app logic)
  - `src/theme/` — tokens, theme generation, motion presets
  - `src/features/library/`, `src/features/pdf/`, `src/features/annotations/`, `src/features/notebook/`
  - `src/lib/` — pure helpers (geometry, coordinate transforms, file formats) — unit-test these
  - `src-tauri/` — Rust: file access, dialogs, open-with/file associations, app data paths
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

## Secrets

There are no secrets in this project. Never create or commit `.env` files with real values —
only `.env.example`. Never read `.env` files.
