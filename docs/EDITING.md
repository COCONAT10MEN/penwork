# Mini edits: what can be changed in the app without asking an AI

Goal: every change that's quicker to do by hand than to describe to an AI. Visual reference:
`design/mockups/v2/edit.html`.

## Principles

- **Edit what's there, using the template's own options.** Users change content and documented choices
  (card style, step animation, column width, background preset…), never raw CSS or free positioning.
- **What you see is the real slide.** Edit mode shows the real engine rendering, fully revealed, with
  step numbers on the elements that appear on click.
- **Everything is undoable** (Ctrl+Z / Ctrl+Y), autosaved to recovery, and saved to the file on Ctrl+S.
- **Structural or creative changes → "Ask AI".** One click copies the slide (or deck) plus instructions
  for Claude. Pasting the reply back replaces or inserts slides after a preview.

## Modes

| Mode | What it's for | How to enter |
|---|---|---|
| **Present** | Teaching. Steps, Morph, dock, ink | ▶ Present, F5, or double-click a deck in Home |
| **Edit** | Mini edits. Slide sorter + stage + inspector | Edit button, Ctrl+E, or ✎ in the dock while presenting (opens on the same slide) |
| **Steps** (sub-mode of Edit) | Click through the slide's steps to see and change what appears when | Segmented button in the top bar |
| **Notes** (sub-mode of Edit) | Speaker notes for each slide | Segmented button in the top bar |

Leaving Edit returns to Present on the same slide and step.

## Selecting

- Hover shows a thin primary outline. Click selects the **nearest editable component** (list below).
  Click again goes one level deeper (card → bullet). Esc goes one level up. A breadcrumb in the inspector
  shows the path: `Slide 2 › Columns › Card › Bullet`.
- Tab / Shift+Tab move between components on the slide (keyboard-only editing must work).
- The selected component gets a primary outline, a small type tag ("Card · Key"), and its step number if it's a step.

## Text editing

- Double-click or Enter on a text component starts inline editing. Only that element becomes `contenteditable`.
- Allowed inline formatting (context toolbar, glass pill above the selection):
  **Bold** (`<b>`), *Italic* (`<i>`), Orange emphasis (`b.or`), Teal (`.tl`), Muted (`.mut`), Clear formatting,
  **Insert formula** (inserts a `<span class="tex">` chip that edits in the formula editor).
- Paste is plain text (formatting from other apps is dropped).
- In lists, Enter adds a bullet and Backspace on an empty bullet removes it. Alt+↑/↓ moves a bullet.
- Esc or clicking outside ends editing. One editing session is one undo step.

## Components and their inspector fields

| Component (template class) | Inspector |
|---|---|
| **Slide** (`section.slide`) | Overview name (`data-title`) · eyebrow text (`.eb`) · background preset (5 previews from AI-GUIDE §3) · hide slide · speaker notes · layout kind (cover / standard), read-only |
| **Title** (`h2`, cover `h1`) | Text, with a warning if longer than ~36 characters (one line) |
| **Card** (`.card` + `soft/key/note/tips/vio`) | Style segmented button · heading text · appears on click |
| **List** (`ul.dots` / `ul.nums`) | Bullets or numbers · reorder items (drag) · each item can be its own step |
| **Formula** (`.tex`, `.fbox`) | Source field (mini-LaTeX) with a **live rendered preview** and red marks for unknown commands · box style (normal / orange / big) |
| **Table** (`table.tbl`) | Cell editing in place · add/remove row/column (warn past 6×5) · tight toggle |
| **Columns** (`.cols`) | Left column width slider (`--c`, 560–1100 px stage units) with live preview |
| **Diagram** (`.svgbox`) | Height slider · caption (`.cap`) · list of highlightable parts (`data-part`) · "Edit SVG source" (advanced, code field, sanitised) |
| **Image** (`img`) | Replace (file picker / drop) · alt text · fit (cover / contain) |
| **Worked example** (`.ex` + `.ans`) | Question text · answer (formula fields) |
| **Quiz** (`script[type=application/json]`) | Question list editor: question, 2–5 options, correct option, explanation. Validates the JSON for you |
| **Recap card** (`.rc .card`) | Title / formula / caption |
| **Cover** (`.hero`) | Kicker · badge word/number · title · table-of-contents chips (add/remove/reorder) |

### Steps (appears on click)

For any block: toggle **Appears on click** (`st`), animation **Fade / From left (`l`) / From right (`r`) / Zoom (`z`)**,
**Together with the previous step** (`data-st="="`), and **highlights diagram part…** (`data-hl`, picked from the
diagram's `data-part` list). The order of steps follows the document order. Changing the order is "Ask AI"
in v1 because it moves layout.

## Slide operations (sorter)

Add slide (from a **layout gallery** built from the template's example slides: cover, two columns, formula, table,
diagram + card, worked example, quiz, recap) · duplicate · delete (undoable) · hide/show · drag to reorder ·
copy/paste slides between decks · multi-select with Shift/Ctrl.

## Deck settings (top-bar menu → Deck)

Title, badge word/number, deck name, kicker (applied to every slide's `.spill` and the cover) · accent colours
(`--teal`, `--or`, `--ink`, `--paper` in `theme.css`, with the blob and badge overrides from AI-GUIDE §10 generated
automatically) · language and direction · "Keep ink in the deck".

## Deck doctor (always on, quiet)

Runs the overflow rules from `check_deck.py` on each slide after every edit (fully revealed): content within 50 px of
the bottom, 100 px of the sides, or a title colliding with the badge. Problems show as a small orange chip on the
slide thumbnail ("Too tall") and a line in the inspector. Unknown formula commands count as problems too.

## Ask AI (the bridge to Claude)

- **Copy slide for AI** / **Copy deck for AI**: puts on the clipboard a short instruction header (the format rules
  from `authoring/AI-GUIDE.md`, condensed) + the slide's (or deck's) HTML + `theme.css` + the request box text the
  user typed ("make this a two-column slide with a diagram"). Ready to paste into Claude chat.
- **Paste reply**: reads `<section>` blocks (and an optional ```` ```css ```` block) from the clipboard, sanitises them,
  shows a before/after preview, then **Replace this slide / Insert after / Cancel**. One undo step.
- Never sends anything anywhere by itself. The user moves the text between apps.

## Keyboard

`Ctrl+E` edit/present · `Ctrl+S` save · `Ctrl+Z`/`Ctrl+Y` undo/redo · `Ctrl+D` duplicate slide · `Del` delete
selection (slide in sorter, bullet/item in stage) · `Enter` edit text · `Esc` up/stop editing · `Tab` next component ·
`Ctrl+B/I` bold/italic · `Alt+↑/↓` move bullet/slide · `F5` present from start, `Shift+F5` from current slide.

## Not mini edits (→ Ask AI)

New layouts, moving things freely, new components or CSS, re-ordering steps across the layout, drawing new
diagrams, writing widgets, translating a whole deck.
