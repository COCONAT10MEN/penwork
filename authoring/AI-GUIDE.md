# Writing a Penwork presentation

Penwork opens `.pwpptx` files, presents them with its own toolbar, and lets the teacher make small edits.
**Your only job is to write the slides.** The app supplies everything else.

## 1 · What a .pwpptx is, and how it relates to HTML

A `.pwpptx` is a **zip file**, like a `.docx`. Inside it, the slides are HTML, but not a web page:

| Older way | In a .pwpptx |
|---|---|
| One `.html` file with the engine inside | No engine. Penwork has its own |
| `<html>`, `<head>`, `<body>`, `<style>`, `<script>` | **None of these.** Only `<section class="slide">` blocks |
| `<style id="theme">` | A separate file, `theme.css` |
| Widget code in the page | A separate file, `widgets.js` |
| Pictures as `data:` text | Files in `assets/`, used as `src="assets/name.png"` |

Penwork never opens plain `.html` files, so a `.pwpptx` is the only way in.

What's in the folder you write:

```
my-presentation/
  manifest.json     required
  slides.html       required: only <section class="slide"> blocks, in order
  theme.css         optional: colours
  widgets.js        optional: interactive widgets
  notes.json        optional: { "<slide data-id>": "speaker notes" }
  assets/           optional: pictures
```

`manifest.json`:

```json
{
  "format": "penwork-deck",
  "version": 1,
  "engine": "lop-1",
  "title": "Newton's Second Law",
  "lang": "en",
  "dir": "ltr",
  "stage": { "w": 1920, "h": 1080 },
  "brand": {
    "badgeWord": "SESSION",
    "badgeNumber": "1",
    "deckName": "Newton's Second Law",
    "kicker": "Physics · Unit 3 · Dynamics"
  },
  "generator": "Claude"
}
```

Pack it with `python pwpptx.py pack my-presentation my-presentation.pwpptx`. The tool needs nothing but
Python. If you can't run Python, make a zip with `mimetype` as its first entry, stored uncompressed, holding
exactly `application/vnd.penwork.deck`, then the other files.

## 2 · Hard rules

1. The stage is a fixed **1920 × 1080** canvas, scaled to the screen. Size things in px, never `vw`, `vh` or `%`.
2. Nothing may load from the internet: no CDNs, web fonts or image URLs. Diagrams are inline SVG.
3. Keep 120 px clear at the sides, 50 px at the top and 66 px at the bottom. Under the title there's about **780 px**
   for `.main`. If it doesn't fit, split the slide. Never go below about 24 px text.
4. A slide title (`h2`) stays on one line, **about 36 characters at most**, as the badge sits to its right.
5. Keep the `.spill` header (badge and name) on every slide, with the same words: Morph glides it between slides.
6. One `<section>` is one slide. Give each a `data-title` and a different `data-bg`.
7. The only `<script>` allowed is quiz data, `<script type="application/json">`, inside a quiz. `on...=` attributes,
   `<style>`, `<iframe>`, `<form>` and `<link>` are removed when the file opens.
8. Don't invent new fonts, shadows or colours on a slide. Use the variables and classes below.

## 3 · Slide skeletons

### Cover (use as slide 1)
```html
<section class="slide hero" data-title="Deck title" data-bg="1300,-320,1;-260,620,1;1560,760,1;120,-300,.9">
  <!-- optional dark photo: <img class="bg" src="assets/photo.jpg" alt=""> -->
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

## 4 · Components (copy from `example/slides.html`)

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

## 8 · Interactive widgets (optional)

In a slide: `<div data-w="myWidget"></div>`. In `widgets.js`: `W.myWidget=function(root){…};`. `root` is the empty div,
so build into it. It runs once, the first time the slide is shown, in a sandbox with no internet and no access to the app.
Use `.sl` for range inputs, `.lbl` and `.val` for labels and `.svgbox` for the frame. For a step hook,
`<section data-onstep="fnName">` calls `W.fnName(section, step)`. Keep it simple: sliders and a live formula. One per slide.

## 9 · What Penwork already does

Don't build these: the toolbar, pen, highlighter, laser, eraser, whiteboard, overview grid, Morph transitions and steps.

## 10 · Colours

`theme.css` sets `--teal` (main accent), `--or` (second accent), `--ink` (headings) and `--paper` (background) in `:root`.
See `example/theme.css`. The teacher can change these in Penwork later.

## 11 · Content design guidance for good slides

* **Structure of a session deck:** cover → 1 slide per concept (definition → formula/derivation → diagram/example) →
  solved examples → quick-check quiz → formula recap. Typically 8–16 slides.
* One idea per slide; a slide is a prompt for the teacher to talk, not a page of text. ≤ 5 bullets, ≤ ~12 words each.
* Prefer diagram + short card over paragraphs. Show each derivation line as its own step.
* Use `card key` for the one sentence students must remember; `card note` for "careful!" remarks.
* Keep the source's terminology and numbers exactly; double-check every formula and worked example by recomputing.
* Colour meaning: teal = given/neutral, orange = the thing to notice/result. Be consistent within a deck.
* Write in the language of the source material; keep each slide's title short in any language.

## 12 · Check before you hand over

```
python pwpptx.py check my-presentation --shots shots
python pwpptx.py pack my-presentation my-presentation.pwpptx
```

`check` finds what Penwork would refuse or remove. `--shots` needs Playwright, and is a rough look: it doesn't have the
app's styles. Penwork's own slide checker marks anything too tall or too wide when the file is opened, so it's fine to say
"open it and look at the thumbnails".

Common mistakes: a title that's too long · so many `st` cards that the last falls off the bottom · maths typed as plain
text · a missing `.spill` · one `data-m` name used twice on a slide · quiz JSON with unescaped quotes · writing `<html>`.
