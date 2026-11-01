import { DEFAULT_THEME, type DeckParts } from "./deckParts";

/**
 * New slides, in the template's own vocabulary
 * (reference/lop-deck/presentation-template/AI-GUIDE.md §3–§4, example-slides.html).
 */

export type StartLayout = "cover" | "columns" | "quiz";
export type SlideLayout = StartLayout | "formula" | "table" | "diagram" | "example" | "recap";

/** The header every slide carries, which Morph glides from slide to slide. */
export interface SlideBrand {
  word: string;
  number: string;
  name: string;
}

export const SLIDE_LAYOUTS: { id: SlideLayout; label: string; icon: string }[] = [
  { id: "cover", label: "Cover", icon: "title" },
  { id: "columns", label: "Two columns", icon: "view_column" },
  { id: "formula", label: "Formula", icon: "functions" },
  { id: "table", label: "Table", icon: "table" },
  { id: "diagram", label: "Diagram and card", icon: "schema" },
  { id: "example", label: "Worked example", icon: "edit_note" },
  { id: "quiz", label: "Quiz", icon: "quiz" },
  { id: "recap", label: "Recap", icon: "summarize" },
];

function escaped(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The presets in AI-GUIDE §3, so the blobs glide between slides. */
const BG = [
  "900,-420,1.2;1500,500,.9;-120,820,1.2;1650,-120,.7",
  "-300,-200,1.1;1180,640,1.1;700,880,.8;1750,120,1",
  "1480,160,1;-180,260,.8;1000,-480,1;500,780,1",
  "200,700,1;1400,-200,1.1;1700,820,.8;-300,-100,1",
  "1100,560,1.3;-100,-120,1;1600,-250,.9;800,-300,.8",
];

function standard(b: SlideBrand, title: string, eyebrow: string, bg: string, main: string): string {
  return `<section class="slide" data-title="${title}" data-bg="${bg}">
  <div class="spill"><span class="sdot" data-m="sdot"><b class="sv">${b.word}</b><b class="sn">${b.number}</b></span><span class="snm" data-m="snm">${b.name}</span></div>
  <div class="body">
    <div class="sec"><div class="eb">${eyebrow}</div><h2>${title}</h2></div>
    <div class="main">${main}</div>
  </div>
</section>`;
}

const COVER = (
  b: SlideBrand,
) => `<section class="slide hero" data-title="${b.name}" data-bg="1300,-320,1;-260,620,1;1560,760,1;120,-300,.9">
  <div class="kick">Course · Chapter</div>
  <div class="mid">
    <div class="sdot big" data-m="sdot"><b class="sv">${b.word}</b><b class="sn">${b.number}</b></div>
    <h1 class="snm big" data-m="snm">${b.name}</h1>
  </div>
  <div class="toc"><div class="c"><i>1</i>First topic</div><div class="c"><i>2</i>Second topic</div></div>
</section>`;

const MAIN: Record<Exclude<SlideLayout, "cover">, () => [string, string, string]> = {
  columns: () => [
    "Two columns",
    "Part 01",
    `<div class="cols" style="--c:820px">
        <div><div class="card soft"><h3><span class="tri">▶</span>Main idea</h3><div style="font-size:29px">Write the main idea here.</div></div></div>
        <div><div class="card key"><div class="ctr" style="font-size:32px">One idea per slide.</div></div></div>
      </div>`,
  ],
  formula: () => [
    "The formula",
    "Part 02",
    `<div class="card soft"><h3><span class="tri">▶</span>Start from the law</h3><div class="ctr"><span class="fbox or"><span class="tex">F = m a</span></span></div></div>
      <div class="ctr" style="margin-top:24px"><span class="fbox big"><span class="tex">a = \\frac{F}{m}</span></span></div>`,
  ],
  table: () => [
    "Quantities and units",
    "Part 03",
    `<table class="tbl"><tr><th>Quantity</th><th>Symbol</th><th>Unit</th></tr><tr><td>Force</td><td><span class="tex">F</span></td><td>newton (N)</td></tr><tr><td>Mass</td><td><span class="tex">m</span></td><td>kilogram (kg)</td></tr></table>`,
  ],
  diagram: () => [
    "Diagram",
    "Part 04",
    `<div class="cols" style="--c:760px">
        <div class="svgbox" style="height:420px;padding:12px"><svg viewBox="0 0 700 420" width="100%" height="100%"><path d="M60 330H640" stroke="#12303d" stroke-width="6" fill="none"></path><rect x="270" y="190" width="170" height="140" rx="10" fill="#e2f3f8" stroke="#0aa0c8" stroke-width="6"></rect></svg></div>
        <div class="card soft"><h3><span class="tri">▶</span>What it shows</h3><div style="font-size:29px">Describe the diagram here.</div></div>
      </div>`,
  ],
  example: () => [
    "Worked example",
    "Part 05",
    `<div class="ex"><div class="n">1</div><div><span class="pill">Solved Ex</span> <span class="q">Write the question here.</span></div></div>
      <div class="ans"><h4>Answer</h4><p><span class="tex">a = \\frac{F}{m}</span></p></div>`,
  ],
  quiz: () => [
    "Quick check",
    "Quick check",
    `<div class="quiz card" style="padding:26px 36px"><div class="qbox"></div><script type="application/json">[
      {"q":"Write your question here","o":["First answer","Second answer","Third answer","Fourth answer"],"a":0,"e":"Explain the right answer here."}
    ]</script></div>`,
  ],
  recap: () => [
    "Recap",
    "Recap",
    `<div class="rc"><div class="card"><div class="t">First idea</div><div class="f"><span class="tex">F = m a</span></div><div class="n">Say what it means</div></div><div class="card"><div class="t">Second idea</div><div class="f"><span class="tex">a = \\frac{F}{m}</span></div><div class="n">Say what it means</div></div></div>`,
  ],
};

export function layoutSlide(layout: SlideLayout, brand: SlideBrand, place = 0): string {
  const b = { word: escaped(brand.word), number: escaped(brand.number), name: escaped(brand.name) };
  if (layout === "cover") return COVER(b);
  const [title, eyebrow, main] = MAIN[layout]();
  return standard(b, title, eyebrow, BG[place % BG.length] ?? "", main);
}

/** A presentation's own header values, from its manifest, with the template's defaults. */
export function brandOf(raw: Record<string, unknown>, title: string): SlideBrand {
  const brand = (typeof raw.brand === "object" && raw.brand !== null ? raw.brand : {}) as Record<
    string,
    unknown
  >;
  const text = (v: unknown, fallback: string) => (typeof v === "string" && v ? v : fallback);
  return {
    word: text(brand.badgeWord, "SESSION"),
    number: text(brand.badgeNumber, "1"),
    name: text(brand.deckName, title),
  };
}

export function newDeck(rawTitle: string, layout: StartLayout): DeckParts {
  const name = rawTitle.trim() || "Untitled presentation";
  const brand = { word: "SESSION", number: "1", name };
  const slides = [layoutSlide("cover", brand)];
  if (layout !== "cover") slides.push(layoutSlide(layout, brand));
  return {
    title: name,
    lang: "en",
    dir: "ltr",
    brand: { badgeWord: "SESSION", badgeNumber: "1", deckName: name },
    slidesHtml: slides.join("\n"),
    themeCss: DEFAULT_THEME,
    widgetsJs: "",
  };
}
