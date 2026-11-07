/**
 * The heavy half of equations (MathJax and the converters), loaded only when a document has
 * equations or the user makes one.
 */
import DOMPurify from "dompurify";
import { texToMathml, texToSvg } from "../../../lib/math/mathjax";
import { mathmlToOmml } from "../../../lib/math/mathmlToOmml";
import {
  equationsToPictures,
  picturesToEquations,
  type EquationPicture,
  type OriginalEquation,
} from "../../../lib/math/docxEquations";

/** Pages are white unless "Dark pages" is on, and Word prints equations black. */
const INK = "#000000";

/** An equation as a picture for the page, sized for text of `sizePt` points. */
export async function picture(latex: string, display: boolean, sizePt: number): Promise<EquationPicture | null> {
  const result = await texToSvg(latex, display, INK);
  if (!result.ok) return null;
  const { width, height, depth } = result.value;
  const pt = (em: number) => `${(em * sizePt).toFixed(3)}pt`;
  const svg = result.value.svg
    .replace(/ width="[\d.]+em"/, ` width="${pt(width)}"`)
    .replace(/ height="[\d.]+em"/, ` height="${pt(height)}"`);
  return { svg, widthPt: width * sizePt, heightPt: height * sizePt, depthPt: depth * sizePt };
}

export type Preview = { ok: true; svg: string } | { ok: false; error: string };

/** The live preview in the equation panel: sized in em, in the panel's text colour. */
export async function preview(latex: string, display: boolean): Promise<Preview> {
  if (!latex.trim()) return { ok: true, svg: "" };
  const result = await texToSvg(latex, display);
  if (!result.ok) return { ok: false, error: result.error };
  const svg = DOMPurify.sanitize(result.value.svg, { USE_PROFILES: { svg: true, svgFilters: false } });
  return { ok: true, svg };
}

/** Word's own equation (OMML) for LaTeX, or null when the LaTeX has a mistake. */
export function toOmml(latex: string, display: boolean): string | null {
  const mml = texToMathml(latex, display);
  if (!mml.ok) return null;
  const math = new DOMParser().parseFromString(mml.value, "application/xml").documentElement;
  return mathmlToOmml(math, display);
}

/** Opening: Word equations become pictures the editor can show. */
export function openEquations(bytes: Uint8Array) {
  return equationsToPictures(bytes, picture);
}

/** Saving: the pictures become Word equations again. */
export function saveEquations(bytes: Uint8Array, originals: Map<string, OriginalEquation>) {
  return picturesToEquations(bytes, originals, toOmml);
}
