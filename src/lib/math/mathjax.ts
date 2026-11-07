/**
 * LaTeX through MathJax: a picture (SVG) to show, and MathML to turn into a Word equation.
 *
 * MathJax runs on its own small DOM (liteAdaptor), so it needs no page and can be tested in Node.
 * Its font loads extra character sets on demand; those are bundled with the app, never fetched.
 */
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { SerializedMmlVisitor } from "@mathjax/src/js/core/MmlTree/SerializedMmlVisitor.js";
import { STATE } from "@mathjax/src/js/core/MathItem.js";
import type { MmlNode } from "@mathjax/src/js/core/MmlTree/MmlNode.js";
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";
import "@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js";
import "@mathjax/src/js/input/tex/cancel/CancelConfiguration.js";
import "@mathjax/src/js/input/tex/color/ColorConfiguration.js";
import "@mathjax/src/js/input/tex/mathtools/MathtoolsConfiguration.js";
import "@mathjax/src/js/input/tex/braket/BraketConfiguration.js";
import "@mathjax/src/js/input/tex/cases/CasesConfiguration.js";
import "@mathjax/src/js/input/tex/centernot/CenternotConfiguration.js";
import "@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js";
import "@mathjax/src/js/input/tex/upgreek/UpgreekConfiguration.js";
import "@mathjax/src/js/input/tex/gensymb/GensymbConfiguration.js";
import "@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js";
import "@mathjax/src/js/input/tex/extpfeil/ExtpfeilConfiguration.js";
import "@mathjax/src/js/input/tex/enclose/EncloseConfiguration.js";
import "@mathjax/src/js/input/tex/bbox/BboxConfiguration.js";
import { MathJaxNewcmFont } from "@mathjax/mathjax-newcm-font/js/svg.js";

const PACKAGES = [
  "base",
  "ams",
  "newcommand",
  "boldsymbol",
  "cancel",
  "color",
  "mathtools",
  "braket",
  "cases",
  "centernot",
  "mhchem",
  "upgreek",
  "gensymb",
  "textmacros",
  "extpfeil",
  "enclose",
  "bbox",
];

const FONT_PARTS = import.meta.glob("/node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/*.js");
mathjax.asyncLoad = (name: string) => {
  const file = name.split("/").pop() ?? "";
  const load = Object.entries(FONT_PARTS).find(([path]) => path.endsWith(`/${file}`))?.[1];
  return load ? load() : Promise.reject(new Error(`no font part ${file}`));
};

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

class TexError extends Error {}

const tex = new TeX({
  packages: PACKAGES,
  // Report mistakes to the caller instead of drawing them in red.
  formatError: (_jax: unknown, err: { message: string }) => {
    throw new TexError(err.message);
  },
});
// Inline line breaking would split one equation into several pictures; Word never does that.
const svg = new SVG({ fontCache: "none", fontData: MathJaxNewcmFont, linebreaks: { inline: false } });
const doc = mathjax.document("", { InputJax: tex, OutputJax: svg });
const serializer = new SerializedMmlVisitor();

export interface Typeset {
  /** A standalone SVG. Sizes are in em of the text it sits in. */
  svg: string;
  /** Width, height and the part below the baseline, in em. */
  width: number;
  height: number;
  depth: number;
}

export type TexResult<T> = { ok: true; value: T } | { ok: false; error: string };

function attempt<T>(work: () => T): TexResult<T> {
  try {
    return { ok: true, value: work() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

/** Runs `work`, waiting for any font part it needs to arrive first. */
async function withFonts<T>(work: () => T): Promise<TexResult<T>> {
  try {
    const value = await mathjax.handleRetriesFor(work);
    return { ok: true, value };
  } catch (error) {
    if (error instanceof TexError) return { ok: false, error: error.message };
    return attempt(work);
  }
}

/** LaTeX as a picture. `color` fills it: a CSS colour, or `currentColor` to follow the page. */
export async function texToSvg(latex: string, display: boolean, color = "currentColor"): Promise<TexResult<Typeset>> {
  return withFonts(() => {
    const node = doc.convert(latex, { display });
    const picture = adaptor.firstChild(node) as ReturnType<typeof adaptor.firstChild>;
    const box = String(adaptor.getAttribute(picture as never, "viewBox")).split(" ").map(Number);
    const [, top, w, h] = box;
    adaptor.removeAttribute(picture as never, "style");
    adaptor.setAttribute(picture as never, "width", `${w / 1000}em`);
    adaptor.setAttribute(picture as never, "height", `${h / 1000}em`);
    let markup = adaptor.outerHTML(picture as never);
    if (color !== "currentColor") markup = markup.replace(/currentColor/g, color);
    return { svg: markup, width: w / 1000, height: h / 1000, depth: (top + h) / 1000 };
  });
}

/** LaTeX as MathML, each part tagged with the LaTeX it came from (`data-latex`). */
export function texToMathml(latex: string, display: boolean): TexResult<string> {
  return attempt(() => {
    const tree = doc.convert(latex, { display, end: STATE.CONVERT }) as MmlNode;
    return serializer.visitTree(tree);
  });
}

/** Whether MathJax reads `latex` without a mistake, and the mistake if not. */
export function checkTex(latex: string): string | null {
  const result = texToMathml(latex, false);
  return result.ok ? null : result.error;
}
