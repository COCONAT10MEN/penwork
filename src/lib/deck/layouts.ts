import { DEFAULT_THEME, type DeckParts } from "./importPaste";

/**
 * The starting slides for New deck, in the template's own vocabulary
 * (reference/lop-deck/presentation-template/AI-GUIDE.md §3). The full layout gallery is M4.
 */

export type StartLayout = "cover" | "columns" | "quiz";

function escaped(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function header(title: string): string {
  return `<div class="spill"><span class="sdot" data-m="sdot"><b class="sv">SESSION</b><b class="sn">1</b></span><span class="snm" data-m="snm">${title}</span></div>`;
}

function cover(title: string): string {
  return `<section class="slide hero" data-title="${title}" data-bg="1300,-320,1;-260,620,1;1560,760,1;120,-300,.9">
  <div class="kick">Course · Chapter</div>
  <div class="mid">
    <div class="sdot big" data-m="sdot"><b class="sv">SESSION</b><b class="sn">1</b></div>
    <h1 class="snm big" data-m="snm">${title}</h1>
  </div>
  <div class="toc"><div class="c"><i>1</i>First topic</div><div class="c"><i>2</i>Second topic</div></div>
</section>`;
}

function columns(title: string): string {
  return `<section class="slide" data-title="First topic" data-bg="900,-420,1.2;1500,500,.9;-120,820,1.2;1650,-120,.7">
  ${header(title)}
  <div class="body">
    <div class="sec"><div class="eb">Part 01</div><h2>First topic</h2></div>
    <div class="main">
      <div class="cols" style="--c:820px">
        <div><div class="card soft"><h3><span class="tri">▶</span>Main idea</h3><div style="font-size:29px">Write the main idea here.</div></div></div>
        <div><div class="card key"><div class="ctr" style="font-size:32px">One idea per slide.</div></div></div>
      </div>
    </div>
  </div>
</section>`;
}

function quiz(title: string): string {
  return `<section class="slide" data-title="Quick check" data-bg="900,-420,1.2;1500,500,.9;-120,820,1.2;1650,-120,.7">
  ${header(title)}
  <div class="body">
    <div class="sec"><div class="eb">Quick check</div><h2>Quick check</h2></div>
    <div class="main"><div class="quiz card" style="padding:26px 36px"><div class="qbox"></div><script type="application/json">[
      {"q":"Write your question here","o":["First answer","Second answer","Third answer","Fourth answer"],"a":0,"e":"Explain the right answer here."}
    ]</script></div></div>
  </div>
</section>`;
}

export function newDeck(rawTitle: string, layout: StartLayout): DeckParts {
  const name = rawTitle.trim() || "Untitled deck";
  const title = escaped(name);
  const slides = [cover(title)];
  if (layout === "columns") slides.push(columns(title));
  if (layout === "quiz") slides.push(quiz(title));
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
