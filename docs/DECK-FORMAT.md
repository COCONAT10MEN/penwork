# `.pwpptx`: Penwork deck format, version 1

Read and written in Rust with the `zip` crate, which streams large decks.

A `.pwpptx` file is a **ZIP archive** (same idea as `.docx`/`.epub`). Inside it, the slides are HTML that uses
the Life of Physics slide vocabulary (`reference/lop-deck/presentation-template/AI-GUIDE.md` §2–§8), which AI already
writes well. The app supplies the engine, the toolbar and the settings. **A deck contains only content.**

## 1. Container layout

```
mimetype            "application/vnd.penwork.deck"   first entry, stored uncompressed (lets us sniff the type)
manifest.json       deck metadata (below)                        required
slides.html         all <section class="slide"> blocks, in order  required
theme.css           deck colours/overrides (old <style id="theme">)  optional
widgets.js          interactive widget code  W.name=function(root){…}  optional
notes.json          { "<slideId>": "speaker notes (plain text / simple markdown)" }  optional
ink.json            saved annotations, including the whiteboard (key "wb"); on by default, see §6  optional
assets/             images and other media, referenced as  src="assets/<name>"  optional
thumbs/             cached PNG thumbnails, keyed by slide id + content hash (may be discarded)  optional
```

Rules:
- UTF-8 everywhere. File names inside the zip use `/`, no `..`, no absolute paths, no names over 120 chars.
- Unknown files are kept when saving (forward compatibility). Unknown manifest keys are kept too.
- Limits (refuse with a clear message beyond these): 500 slides, 200 MB total, 50 MB per asset.

## 2. `manifest.json`

```jsonc
{
  "format": "penwork-deck",
  "version": 1,                 // format version. Readers refuse >1 with "made by a newer Penwork"
  "engine": "lop-1",            // slide vocabulary/engine version the deck was written for
  "title": "Newton's Second Law",
  "lang": "en",                 // BCP-47; "dir" derives from it unless set
  "dir": "ltr",                 // "ltr" | "rtl"
  "stage": { "w": 1920, "h": 1080 },
  "brand": {                    // deck-wide header values, mirrored into every .spill by the editor
    "badgeWord": "SESSION",
    "badgeNumber": "1",
    "deckName": "Newton's Second Law",
    "kicker": "Physics · Unit 3 · Dynamics"
  },
  "created": "2026-10-30T18:00:00Z",
  "modified": "2026-10-30T18:20:00Z",
  "generator": "Claude (AI-GUIDE v1)",   // free text: who wrote it
  "settings": {}                // optional per-deck presentation defaults, same shape as app settings (rarely used)
}
```

## 3. `slides.html`

- Contains **only** `<section class="slide …">…</section>` elements, as in the AI-GUIDE. No `<html>`, `<head>`,
  `<body>`, `<link>`, or external URLs.
- Every section gets a stable **`data-id`** (`s-` + 8 random base36 chars). The app adds missing ids on import
  and never changes an existing one. Notes, ink and thumbnails are keyed by it.
- New attributes the app understands:
  - `data-hidden="true"`: skipped when presenting, still shown in the editor.
  - `data-id`: see above.
- Everything else (`data-title`, `data-bg`, `data-m`, `.st`, `data-st`, `data-hl`, `data-part`, `data-w`,
  `data-onstep`, quiz `<script type="application/json">`) keeps the meaning the AI-GUIDE gives it.

## 4. Sanitising (on every load, paste and import)

Use DOMPurify (dependency, credited) with an allow-list. Then the app's own checks:

- Allowed: normal HTML text/layout elements, inline `<svg>` (with its normal children), `<img>`, `<table>`,
  `<script type="application/json">` **only inside a quiz slide**.
- Removed: other `<script>`, `on*=` attributes, `javascript:` URLs, `<iframe>`, `<object>`, `<embed>`, `<link>`,
  `<meta>`, `<base>`, `<form>`, external `src`/`href` (anything with a scheme other than `assets/`, `data:image/…`, `#…`).
- `data:image/…` sources are moved into `assets/` (deduplicated by SHA-256) **when the deck is opened**, so large images
  don't sit in the undo history or bridge messages.
- Keep everything the vocabulary needs: `style` attributes (for `--c`, heights), all `data-*` attributes, SVG `class`.
- Quiz JSON must parse, and its `q`, `o` and `e` text is sanitised too, because the engine inserts it as HTML.
- The sandbox and CSP are what keep a deck contained. The sanitiser keeps files clean; never rely on it alone.
- A test must show the 8-slide demo passes through unchanged.
- Report what was removed in a small "Cleaned up while opening" note, and warn before Save, because removed content is
  then gone from the file. Never fail silently.

## 5. `widgets.js`

- Same contract as the template: `W.name = function (root) { … }`, optional `W.fn(section, step)` for `data-onstep`.
- Runs **only inside the sandboxed slide iframe** (no network, no access to the app).
- A deck with widgets shows a small "Interactive" chip in the library. Nothing more is needed because the code
  is sandboxed.

## 6. `ink.json` (when ink is saved with the deck)

```jsonc
{ "version": 1,
  "slides": { "<slideId>": [ { "k": "p", "c": "#e5352b", "w": 8, "op": 1, "pts": [[x, y, p], …] },
                              { "k": "h", "c": "#ffe14a", "w": 38, "op": 0.42, "pts": [[x, y, p], …] } ] } }
```
Coordinates are in **stage units (1920×1080)**, so ink survives any window size. `k`: `p` pen, `h` highlighter.
By default ink **is** saved into the deck, so it travels with the file. The "Keep ink in the deck" setting can turn this off.
The whiteboard uses the key `"wb"` in place of a slide id.

## 7. Other ways in (importers)

| Input | What happens |
|---|---|
| `.pwpptx` | Open directly. |
| New deck | Made in the app from a starting layout, as a real `.pwpptx`. |
| Raw `.html` files | **Refused.** Penwork never opens or imports them, by drag-and-drop, Open with or any other way (owner decision, 2026-10-31). |
| Paste from AI on Home | **Removed** (owner decision, 2026-10-31). AI-written decks arrive as `.pwpptx`, packed with the authoring kit (§9). |

## 8. Saving

- Write to `<name>.pwpptx.tmp` in the same folder, flush, then rename over the original (atomic on NTFS).
- Keep `mimetype` first and uncompressed, then the other files deflated.
- Autosave goes to a **recovery file** in app data every ~5 s while there are unsaved changes, never to the
  user's file. On launch, offer to recover; if the file changed after the recovery copy was written, say so.

## 9. Authoring kit for AI (built in milestone M4, see roadmap)

Lives in `authoring/` in the repo and is also exportable from the app (Settings → "Get the AI kit"):

- `AI-GUIDE.md`: the template guide adapted to `.pwpptx`. It must explain exactly how `.pwpptx` relates to plain HTML: it is a
  zip, slides are HTML fragments, there is no engine, `<html>` or `<head>` to write, and how to pack it. Engine-editing rules removed. Asks the AI for `slides.html`
  (+ optional `theme.css`, `widgets.js`) and a manifest. Keeps the slide vocabulary, size limits, Morph tips and math rules.
- `pwpptx.py`: **Python standard library only**, so it runs in Claude's sandbox and on Windows.
  `pack <folder> <out.pwpptx>` · `unpack` · `check` (structure + sanitiser rules + manifest schema). The optional `--shots` flag
  renders screenshots with Playwright if it's installed (port of `check_deck.py` overflow rules: <50 px from the bottom,
  <100 px from the sides, title colliding with the badge).
- `example/`: the 8-slide demo deck as a folder and as a `.pwpptx`.
- `PROMPT.md`: the copy-paste prompt for Claude chat and for Claude Code.

## 10. Versioning

- `version` changes only for breaking container changes. Additive keys don't bump it.
- `engine` bumps when the slide vocabulary changes. The app keeps old engines working, or converts on open
  with the owner's confirmation.
