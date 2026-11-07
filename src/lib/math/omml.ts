/** Small helpers for writing Office Math (OMML), the equation format inside .docx files. */

export const OMML_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math";
export const WML_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Word's own font for equations. Every run Word writes names it, so ours do too. */
const MATH_FONT = '<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr>';

export interface RunStyle {
  /** `m:scr`: double-struck, script, fraktur, sans-serif, monospace, roman. */
  script?: string;
  /** `m:sty`: p (upright), b (bold), i (italic), bi (bold italic). */
  style?: "p" | "b" | "i" | "bi";
  /** `m:nor`: ordinary text, as `\text{}` gives. */
  normal?: boolean;
}

export function run(text: string, style: RunStyle = {}): string {
  if (!text) return "";
  // The schema fixes this order: nor, then scr, then sty.
  const props =
    (style.normal ? "<m:nor/>" : "") +
    (style.script ? `<m:scr m:val="${style.script}"/>` : "") +
    (style.style ? `<m:sty m:val="${style.style}"/>` : "");
  const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
  return `<m:r>${props ? `<m:rPr>${props}</m:rPr>` : ""}${MATH_FONT}<m:t${space}>${escapeXml(text)}</m:t></m:r>`;
}

/** One OMML element: `<m:name>` with a property block (left out when empty) and its children. */
export function el(name: string, props: string, children: string): string {
  const pr = props ? `<m:${name}Pr>${props}</m:${name}Pr>` : "";
  return `<m:${name}>${pr}${children}</m:${name}>`;
}

/** An argument slot such as `m:e`, `m:num` or `m:sub`. Word accepts an empty one. */
export function slot(name: string, content: string): string {
  return content ? `<m:${name}>${content}</m:${name}>` : `<m:${name}/>`;
}

export function val(name: string, value: string): string {
  return `<m:${name} m:val="${escapeXml(value)}"/>`;
}

/** Wraps equation content as a whole equation: inline, or a display equation on its own line. */
export function equation(content: string, display: boolean): string {
  const math = `<m:oMath xmlns:m="${OMML_NS}" xmlns:w="${WML_NS}">${content}</m:oMath>`;
  if (!display) return math;
  return `<m:oMathPara xmlns:m="${OMML_NS}" xmlns:w="${WML_NS}"><m:oMath>${content}</m:oMath></m:oMathPara>`;
}
