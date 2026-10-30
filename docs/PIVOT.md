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
- Never overwrite the owner's files silently. An imported `.html` deck is never written back. A `.pwpptx`
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
- **Product: a presentation app.** Open `.pwpptx` decks (and import Life of Physics `.html` decks and
  AI-written slides), present them, and make small edits in the app. See `docs/PIVOT.md`.
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
