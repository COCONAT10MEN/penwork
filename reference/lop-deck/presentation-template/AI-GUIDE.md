# Presentation template — guide for any AI (chat or coding agent)

This package turns lesson material into a **single-file HTML presentation** with PowerPoint-Morph-style transitions,
step-by-step reveals, a pen/highlighter/laser/eraser toolbar with per-tool settings, a whiteboard, an overview grid, math, tables, interactive
widgets and a built-in quiz. The engine is finished. **Your only job is to write the slides.**

Package contents

| File | What it is |
|---|---|
| `deck-template.html` | The engine + a working 8-slide demo deck. Open it in a browser to see every component. |
| `example-slides.html` | The demo slides on their own — copy their markup. |
| `build_deck.py` | Merges *your slides* into the template → one finished `.html`. |
| `check_deck.py` | Screenshots every slide and reports overflow / console errors. |
| `AI-GUIDE.md` | This file. |

---

## 1 · Copy-paste prompt (give this to the AI together with your lesson material)

```
You are building a classroom presentation as one self-contained HTML file using the attached template
(deck-template.html, example-slides.html, build_deck.py, AI-GUIDE.md). Read AI-GUIDE.md fully first.

Material: [attach the PDF / text / notes, or write the topic]
Deck title: [e.g. "Session 6 · The Torque & The Galvanometer"]   Badge number/word: [6 / SESSION]
Cover kicker line: [e.g. "Life of Physics · Chapter 2"]
Language: [English]   Audience: [grade / level]   Target length: [~12–16 slides]
Accent colours: [keep default | e.g. green #1e9d63 + gold #d9a21b]

Rules:
1. Do NOT edit the engine (everything except the <section class="slide"> blocks and the #theme <style>).
2. Follow the slide structure, component classes and size limits in AI-GUIDE.md exactly; reuse the markup patterns from
   example-slides.html instead of inventing new CSS.
3. Reuse the same words in consecutive slide titles and give persistent diagrams the same data-m name so the Morph
   transition can glide them (see "Morph" in the guide).
4. Write all math with <span class="tex">…</span> (mini-LaTeX, see guide) — never flat text like "F=m*a".
5. One idea per slide, reveal it step by step with the "st" class, finish with a quiz slide and a recap slide.
6. When finished, build and verify: run build_deck.py, then check_deck.py, LOOK at the screenshots, fix every overflow,
   and repeat until clean. Then give me the final .html file.
```

### Two ways to work

* **Agentic coder (Claude Code, Cursor, Codex …)** — put the package in the project folder. Write `my-slides.html`
  (slides only), run `python build_deck.py my-slides.html Output.html --title "…"`, then
  `python check_deck.py Output.html`. Open the PNGs, fix, repeat.
* **Plain chat (no file access)** — ask the AI to reply with **only** the `<section class="slide">…</section>` blocks
  (plus optionally one ```` ```css ```` block for extra rules). Save the slides as `my-slides.html` and run
  `build_deck.py`. No Python? Open `deck-template.html` in a text editor and paste your sections between
  `<!-- SLIDES:START -->` and `<!-- SLIDES:END -->`, replacing the demo slides.

---

## 2 · Hard rules

1. The stage is a fixed **1920 × 1080** canvas that is scaled to the screen. Never use `vw/vh/%` for slide sizing; use px.
2. Only edit: the `<section class="slide">` blocks, the `<title>`, and `<style id="theme">`. Never touch the other
   `<style>`, the `<script>`, or the `#stage, #bgl, #wb, #inkwrap, #dock, #ov, #toast` containers.
3. No external resources (CDNs, web fonts, image URLs). Photos must be base64 `data:` URIs; diagrams are inline SVG.
4. Safe content area: left/right **120 px**, top **50 px**, bottom **66 px** → 1680 × ~964. Under the title there are
   roughly **780 px** of height for the `.main` block. If it doesn't fit, split the slide — never shrink text below ~24 px.
5. The slide title (`h2`) is one line, no wrapping (**≈ 36 characters max**, the session badge sits to its right).
6. Do not remove the `.spill` header (badge + deck name): the Morph transition glides it from slide to slide.
7. Keep every `<section>` direct child of `#stage`; one `<section>` = one slide. Quiz data goes in a
   `<script type="application/json">` (the only script allowed in a slide).
8. Don't invent new fonts, shadows or colours per slide. Use the CSS variables / classes below.

---

## 3 · Slide skeletons

### Cover (use as slide 1)
```html
<section class="slide hero" data-title="Deck title" data-bg="1300,-320,1;-260,620,1;1560,760,1;120,-300,.9">
  <!-- optional dark photo: <img class="bg" src="data:image/jpeg;base64,..." alt=""> -->
  <div class="kick">Course · Chapter</div>
  <div class="mid">
    <div class="sdot big" data-m="sdot"><b class="sv">SESSION</b><b class="sn">1</b></div>
    <h1 class="snm big" data-m="snm">Deck title</h1>
  </div>
  <div class="toc"><div class="c"><i>1</i>First topic</div><div class="c"><i>2</i>Second topic</div></div>
</section>
```
`data-title` = name in the overview grid. `.sv` = the vertical word in the round badge (SESSION / LESSON / UNIT…), `.sn` = its number.
Keep the cover title ≤ ~28 characters (one line). 3–5 chips in `.toc`.

### Standard slide
```html
<section class="slide" data-title="Name in overview" data-bg="900,-420,1.2;1500,500,.9;-120,820,1.2;1650,-120,.7">
  <div class="spill"><span class="sdot" data-m="sdot"><b class="sv">SESSION</b><b class="sn">1</b></span><span class="snm" data-m="snm">Deck title</span></div>
  <div class="body">
    <div class="sec"><div class="eb">Part 01</div><h2>Slide title (one line)</h2></div>
    <div class="main"> … content … </div>
  </div>
</section>
```
`.eb` = small eyebrow above the title ("Part 01", "Quick check", "Recap"…).
`data-bg` = positions of the four background blobs as `x,y,scale;` ×4. Change it on every slide (the blobs glide between
slides). Presets to rotate through:
`900,-420,1.2;1500,500,.9;-120,820,1.2;1650,-120,.7` · `-300,-200,1.1;1180,640,1.1;700,880,.8;1750,120,1` ·
`1480,160,1;-180,260,.8;1000,-480,1;500,780,1.2` · `200,700,1;1400,-200,1.1;1700,820,.8;-300,-100,1` ·
`1100,560,1.3;-100,-120,1;1600,-250,.9;800,-300,.8`.

---

## 4 · Components (copy from `example-slides.html`)

**Layout**
* Two columns: `<div class="cols" style="--c:780px"> <div>left</div> <div>right</div> </div>` — `--c` is the left column width
  (right takes the rest). Typical: 720–820px.
* Grids: `.g2` (2 equal columns), `.g3` (3), `.row` (flex row), `.ctr` (centre text).

**Cards** `<div class="card [soft|key|note|tips|vio]">` — plain white · tinted blue (default for content) · orange-outlined
(the key takeaway) · dashed "Note" label · "Tips" label · violet note. Put a title in `<h3><span class="tri">▶</span>Title</h3>`.
Inside use `font-size:26–31px` text, `<b>` for key terms, `<b class="or">` for orange emphasis, `.tl` teal, `.mut` grey.

**Lists** `<ul class="dots"><li>…</li></ul>` (teal bullets) or `<ul class="nums">` (numbered circles).

**Formula box** `<span class="fbox [or|big]"><span class="tex">F = m a</span></span>` (wrap in `<div class="ctr">` to centre).

**Table** `<table class="tbl [tight]"><tr><th>…</th></tr><tr><td>…</td></tr></table>` — max ≈ 6 rows × 5 columns.

**Diagram box** `<div class="svgbox" style="height:420px;padding:12px"><svg viewBox="0 0 700 420" width="100%" height="100%">…</svg></div>`
with an optional caption `<div class="cap">…</div>`. Draw diagrams as inline SVG (see the demo). Use stroke widths ≥ 4 and
text ≥ 24 (in viewBox units at a ~700 px wide box) so it is readable from the back of a class.

**Worked example**
```html
<div class="ex"><div class="n">1</div><div><span class="pill">Solved Ex</span> <span class="q">Question text…</span></div></div>
<div class="ans"><h4>Answer</h4><p><span class="tex">a = \frac{F}{m} = 4</span></p></div>
```

**Quiz slide** — copy slide 7 of the demo. JSON per question: `{"q":"…","o":["A","B","C","D"],"a":0,"e":"explanation"}`
(`a` = index of the correct option, 3–5 questions; HTML and `<span class="tex">` are allowed in `q`, `o` and `e`; escape
quotes and backslashes as JSON: `\"` and `\\frac`).

**Recap slide** — `<div class="rc">` grid of `.card` with `.t` (small caps title), `.f` (big formula), `.n` (caption).

---

## 5 · Step-by-step reveals (`st`)

Add class `st` to a block and it appears on the next click/space/→ (and disappears on ←). Presenter flow: slide appears
with only the non-`st` content, each click reveals the next `st` in document order.

```html
<div class="st">…appears on click 1…</div>
<div class="st">…click 2…</div>
<div class="st" data-st="=">…appears together with the previous one…</div>
<ul class="dots"><li class="st">…</li><li class="st">…</li></ul>      <!-- bullets one by one -->
<div class="st l">slides in from the left</div>  <!-- also .r (right) and .z (zoom) -->
```
Guidelines: ≤ 8 clicks per slide; reveal in the order you'd say it; the title and the main diagram are normally visible at
once (no `st`); a fully revealed slide must fit the safe area.

**Highlight diagram parts with steps:** wrap SVG pieces in `<g class="part" data-part="F">…</g>` and put
`data-hl="F"` on the step that talks about it → while that step is the latest visible one, `F` is highlighted and the other
parts dim (see slide 3 of the demo).

---

## 6 · Math — `<span class="tex">…</span>`

Mini-LaTeX, converted at start-up into stacked fractions, sub/superscripts and italics. Examples:

| Write | Result |
|---|---|
| `F = m a` | italic variables |
| `\frac{I_g R_g}{I - I_g}` | stacked fraction (nest freely) |
| `R_s`, `R_{ammeter}`, `x^2`, `10^{-3}` | subscript / superscript (multi-letter subscripts stay upright) |
| `\sqrt{a^2+b^2}` | square root |
| `\u{N}`, `\u{kg\cdot m/s^2}` | **upright** text — use for units and words |
| `\theta \phi \tau \mu \pi \rho \alpha \beta \lambda \omega \Omega \Delta \Sigma` | Greek |
| `\times \cdot \pm \approx \propto \neq \ge \le \to \Rightarrow \therefore \because \perp \infty \deg` | symbols |
| `\sin \cos \tan \log \ln` | upright functions |
| `\ ` (backslash + space) or `\,` | space |

Rules: never write maths as plain text ("F=ma"); a unit is always `\u{…}`; put a space before units: `4\ \u{m/s^2}`;
escape `<` as `&lt;` inside HTML. Unknown commands show in red so you can spot them. Works inside `.fbox`, cards, tables,
quiz text. In JavaScript widgets use `__tex('a = \\frac{F}{m}')` which returns HTML.

---

## 7 · Morph — how the transitions work (so you can feed them)

Between slides the engine automatically:
* **moves identical words** to their new position/size (a word in a bullet flies up into the next slide's title);
* **glides cards/diagram boxes** into their new frame while the contents crossfade;
* glides elements that have the **same `data-m` name** or the **same formula text** (`.fbox`);
* fades in everything else, staggered; the background blobs glide to the next `data-bg`.

So: **reuse key words in neighbouring titles/bullets**, keep a persistent diagram in the **same column with the same
`data-m="name"`** (names unique within a slide), repeat a formula `.fbox` with identical text when it should travel,
and let diagrams evolve (same box, different drawing) rather than being replaced by a new layout each slide. Don't fight it
with your own CSS animations or `position:absolute` tricks.

---

## 8 · Interactive widgets (optional)

1. In the slide: `<div data-w="myWidget"></div>`
2. Put the JS in a file `widgets.js` containing `W.myWidget=function(root){…};` and build with
   `python build_deck.py slides.html Out.html --js widgets.js` (it is inserted next to the demo widget; or paste it after `W.demo` by hand). `root` is the empty div; build it with `root.innerHTML = …` and
   attach `oninput` handlers. It runs once, the first time the slide is shown. Use `.sl` for range inputs, `.lbl`/`.val`
   for labels, `.svgbox` for the frame (see `W.demo`).
3. Slide-level step hook: `<section data-onstep="fnName">` calls `W.fnName(sectionElement, stepNumber)` on every step.
Keep widgets simple: sliders + a live formula/bar/SVG. One per slide.

---

## 9 · Presenter features that already exist (don't re-implement)

Keys: `→ Space PageDown` next · `← PageUp` back · `Home/End` · `G` overview grid · `F` full screen · `A` toggle annotation · `Ctrl+Z` undo · `Ctrl+Y` redo ·
`P` pen · `H` highlighter · `L` laser · `E` eraser · `C` clear · `W` whiteboard (`B` background) · `Esc` close popover / leave annotation.
Touch: swipe / tap to navigate; the stylus draws (barrel button erases). Mouse draws only while a drawing tool is armed or the
whiteboard is on. The last slide's "next" loops to the cover.

**Toolbar (the "dock")** — it starts as just the **logo** (a dark glass circle with the Life of Physics atom mark). Interaction:
- **Tap the logo** → the logo and the toolbar grow into one teal-framed capsule (colours invert while it opens). Tap again to close it.
- **Drag the logo** anywhere → snaps to a corner / bottom / top centre. **Right-click or long-press the logo** → toolbar settings.
- Left alone while closed, the logo fades and **sinks half-way off its screen edge**; hover / touch brings it back.
- Buttons, left to right: pointer · pen · highlighter · laser · eraser | undo · redo · clear · show/hide ink | (board background — whiteboard only)
  · whiteboard · all-slides grid · **full screen (always last)**. Order and visibility are set in the settings; hiding / showing a button animates.
- **Tap a selected tool again → its settings popover** (double-tap and right-click do the same; all three gestures can be switched off).
  Every tool keeps its own settings (nothing is shared): pen = 4 preset colours + 3 saved custom colours + a colour picker (saturation/value square,
  hue slider, hex field), 3 sizes + slider, pressure toggle; highlighter = same + **strength** (applied per stroke — old strokes keep the strength
  they were drawn with); laser = colour, size, trail length; eraser = size. Live preview, Reset per tool.
- **Toolbar settings** (right-click / long-press the logo): start open, auto-hide + delay, starting tool, horizontal / vertical, position,
  **tablet mode** (Auto / On / Off — On by default: bigger buttons, sliders and switches for touch), tool gestures, reorder / hide every button,
  Export / Import the settings as a JSON file, Reset all.
- Everything is stored in one `localStorage` key (`lop-settings1`: `{ui:{…layout…}, tools:{…per-tool…}}`) — shared by every deck opened from
  the same place (Chrome shares it between local files). To ship different defaults inside a deck, define `window.LOP_DEFAULTS={ui:{…},tools:{…}}`
  in a `<script>` placed **before** the main script (same shape as the exported JSON).
- The logo is the `LOGO_SVG` string at the top of the dock code (single colour, `fill:currentColor`). Swap it for your own brand mark.
- Grid view always shows (and returns to) slides fully revealed, so opening / leaving it never "cuts".
- Defaults for colours / sizes / ranges live in the `COL`, `SZ`, `RNG`, `defCfg()` constants and the item list in `ITEMS` / `ORDER_DEF`.

---

## 10 · Theme & branding

* Colours: edit the `:root` variables in `<style id="theme">` (`--teal` main accent, `--or` second accent, `--ink`
  headings, `--paper` background). The badge gradient and the four background blobs (`.b0–.b3`) use teal/orange too —
  override them in the same block if you change accents, e.g. `.b0{background:radial-gradient(circle at 40% 40%,rgba(30,157,99,.16),rgba(30,157,99,.03) 65%,transparent 72%)}`
  and `.sdot{background:radial-gradient(circle at 35% 28%,#34c27f 0,#136b42 55%,#08281a 100%)}`.
* Badge word/number: `.sv` / `.sn` in every `.spill` and on the cover (keep them identical on all slides).
* No footer, no page numbers (deliberate).
* Tab title: `build_deck.py --title "Session 6 · Topic — Course"`.

---

## 11 · Content design guidance for good slides

* **Structure of a session deck:** cover → 1 slide per concept (definition → formula/derivation → diagram/example) →
  solved examples → quick-check quiz → formula recap. Typically 8–16 slides.
* One idea per slide; a slide is a prompt for the teacher to talk, not a page of text. ≤ 5 bullets, ≤ ~12 words each.
* Prefer diagram + short card over paragraphs. Show each derivation line as its own step.
* Use `card key` for the one sentence students must remember; `card note` for "careful!" remarks.
* Keep the source's terminology and numbers exactly; double-check every formula and worked example by recomputing.
* Colour meaning: teal = given/neutral, orange = the thing to notice/result. Be consistent within a deck.
* Write in the language of the source material; keep each slide's title short in any language.

---

## 12 · Verify before you hand over (mandatory)

```
python build_deck.py my-slides.html Output.html --title "…"
python check_deck.py Output.html shots
```
`check_deck.py` prints slides with overflow (anything under 50 px from the bottom, 100 px from the sides, or a title colliding
with the badge) and console errors, and writes `shots/slide_NN.png` + `contact_sheet.png`. **Open the images and look**:
text cut off, cards touching, empty halves, tiny text, wrong maths. Fix and re-run until: 0 overflow, no console errors,
every formula renders (no red text), every slide readable from the back row.

Common mistakes: title too long · too many `st` cards so the last one falls off the bottom · maths typed as plain text ·
forgetting `.spill` · reusing one `data-m` name twice on a slide · a quiz JSON with unescaped quotes · a photo that isn't
base64 · editing the engine.
