/**
 * MathML (as MathJax writes it from LaTeX) to Office Math (OMML), so Word gets a real equation.
 *
 * No permissive library does this in a browser (the one that exists is LGPL), so it's ours.
 * It follows how Word itself stores each structure (checked by building equations in Word).
 */
import { el, equation, run, slot, val, type RunStyle } from "./omml";

const LARGE_OPS = new Set([..."∑∏∐∫∬∭∮∯∰⨌⋃⋂⋁⋀⨁⨂⨀⨄⨆"]);

/** Operators that end the body of a sum or integral, as they do in Word's own typing. */
const BODY_STOPS = new Set([
  ..."=≠<>≤≥≈≡∼≃≅∝→←↔⇒⇐⇔⟹⟸⟺∈∉∋⊂⊆⊃⊇≪≫≺≻⪯⪰+-−±∓,;:|",
  ":=",
]);
const INVISIBLE = new Set(["⁡", "⁢", "⁣", "⁤"]);

/** Accent characters as MathJax draws them, and the combining mark Word stores. */
const ACCENTS: Record<string, string> = {
  "^": "̂",
  "ˆ": "̂",
  "̂": "̂",
  "~": "̃",
  "˜": "̃",
  "̃": "̃",
  "¯": "̄",
  "ˉ": "̄",
  "̄": "̄",
  "→": "⃗",
  "⃗": "⃗",
  "←": "⃖",
  "↔": "⃡",
  "˙": "̇",
  "̇": "̇",
  "¨": "̈",
  "̈": "̈",
  "ˇ": "̌",
  "̌": "̌",
  "˘": "̆",
  "̆": "̆",
  "´": "́",
  "́": "́",
  "`": "̀",
  "̀": "̀",
  "˚": "̊",
  "̊": "̊",
};
/** mhchem draws its arrows from MathJax's private characters; Word needs real ones. */
const MHCHEM_ARROWS: Record<string, string> = {
  "\uE428": "⟵",
  "\uE429": "⟶",
  "\uE42A": "⟷",
  "\uE408": "⇌",
  "\uE409": "⇌",
  "\uE40A": "⇋",
  "\uE42B": "⇄",
  "\uE42D": "→",
  "\uE42C": "←",
  "\uE42E": "↔",
  "\uE410": "≡",
  "\uE411": "≡",
  "\uE412": "≡",
  "\uE413": "≡",
};
const BARS = new Set(["―", "‾", "_", "¯", "̲", "−", "—"]);
const GROUP_CHARS = new Set(["⏞", "⏟", "⏜", "⏝", "⎴", "⎵"]);

const MATRIX_ENVS = /^(matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|smallmatrix|array|subarray)\*?$/;

const VARIANTS: Record<string, RunStyle> = {
  normal: { style: "p" },
  bold: { style: "b" },
  italic: {},
  "bold-italic": { style: "bi" },
  "double-struck": { script: "double-struck", style: "p" },
  script: { script: "script", style: "p" },
  "bold-script": { script: "script", style: "b" },
  fraktur: { script: "fraktur", style: "p" },
  "bold-fraktur": { script: "fraktur", style: "b" },
  "sans-serif": { script: "sans-serif", style: "p" },
  "bold-sans-serif": { script: "sans-serif", style: "b" },
  "sans-serif-italic": { script: "sans-serif", style: "i" },
  "sans-serif-bold-italic": { script: "sans-serif", style: "bi" },
  monospace: { script: "monospace", style: "p" },
};

const kids = (node: Element): Element[] => Array.from(node.children);
const text = (node: Element): string => (node.textContent ?? "").replace(/ /g, " ");
const isLetter = (s: string) => /\p{L}/u.test(s);

/** Collects a row's output, merging neighbouring runs of one style the way Word does. */
class Out {
  private parts: (string | { text: string; style: RunStyle })[] = [];
  text(value: string, style: RunStyle = {}) {
    if (!value) return;
    const last = this.parts[this.parts.length - 1];
    if (typeof last === "object" && sameStyle(last.style, style)) last.text += value;
    else this.parts.push({ text: value, style });
  }
  xml(value: string) {
    if (value) this.parts.push(value);
  }
  /** Takes back the last thing written, to put scripts on it. A run gives up its last letter. */
  takeLast(): string {
    const last = this.parts[this.parts.length - 1];
    if (last === undefined) return "";
    if (typeof last === "string") return this.parts.pop() as string;
    const chars = [...last.text];
    const tail = chars.pop() ?? "";
    last.text = chars.join("");
    if (!last.text) this.parts.pop();
    return run(tail, last.style);
  }
  /** Whether a script here has something to sit on: not an operator, not the start. */
  get hasBase() {
    const last = this.parts[this.parts.length - 1];
    if (last === undefined) return false;
    return typeof last === "string" || !/[\s+\-−=,;(→⟶⟵⟷⇌⇋⇄←↔]$/u.test(last.text);
  }
  toString() {
    return this.parts.map((p) => (typeof p === "string" ? p : run(p.text, p.style))).join("");
  }
}

function sameStyle(a: RunStyle, b: RunStyle) {
  return a.script === b.script && a.style === b.style && a.normal === b.normal;
}

/** The single meaningful element inside wrappers MathJax adds (`mrow` around one child). */
function core(node: Element): Element {
  let n = node;
  while ((n.localName === "mrow" || n.localName === "mstyle") && n.children.length === 1) {
    n = n.children[0];
  }
  return n;
}

function isEmpty(node: Element | undefined): boolean {
  if (!node) return true;
  return node.children.length === 0 && text(node) === "" && node.localName !== "mspace";
}

function opChar(node: Element | undefined): string | null {
  if (!node) return null;
  const n = core(node);
  return n.localName === "mo" ? text(n).trim() : null;
}

function isLargeOp(node: Element | undefined): boolean {
  const c = opChar(node);
  return c !== null && LARGE_OPS.has(c);
}

/** A script or limits structure whose base is a big operator such as ∑ or ∫. */
function naryParts(node: Element) {
  const name = node.localName;
  const [base, a, b] = kids(node);
  if (name === "mo" && isLargeOp(node)) return { op: text(node).trim(), sub: undefined, sup: undefined, under: false };
  if (!["msub", "msup", "msubsup", "munder", "mover", "munderover"].includes(name)) return null;
  if (!isLargeOp(base)) return null;
  const op = opChar(base) ?? "∫";
  const under = name.startsWith("mu");
  const hasSub = name === "msub" || name === "msubsup" || name === "munder" || name === "munderover";
  const hasSup = name === "msup" || name === "msubsup" || name === "mover" || name === "munderover";
  const sub = hasSub ? a : undefined;
  const sup = hasSup ? (hasSub ? b : a) : undefined;
  return { op, sub, sup, under };
}

/** A fence: `\left(` … `\right)`, and the `\binom` shape, which wraps each bracket in an mrow. */
function fenceChar(node: Element | undefined, side: "OPEN" | "CLOSE"): string | null {
  if (!node || node.getAttribute("data-mjx-texclass") !== side) return null;
  if (node.localName === "mo") return text(node).trim();
  if (node.localName === "mrow" && node.children.length === 1 && node.children[0].localName === "mo") {
    return text(node.children[0]).trim();
  }
  return null;
}

export function mathmlToOmml(math: Element, display = math.getAttribute("display") === "block"): string {
  return equation(row(kids(math)), display);
}

function row(items: Element[]): string {
  const out = new Out();
  for (let i = 0; i < items.length; i++) {
    const node = items[i];
    const next = items[i + 1];
    // A big operator takes what follows as its body, up to the next relation or plus/minus.
    const nary = naryParts(node);
    if (nary) {
      let j = i + 1;
      while (j < items.length && !BODY_STOPS.has(opChar(items[j]) ?? "")) j++;
      out.xml(naryXml(nary, row(items.slice(i + 1, j))));
      i = j - 1;
      continue;
    }
    // A function name, then U+2061, then its argument: `\sin x`, `\lim_{n} a_n`.
    if (next && opChar(next) === "⁡") {
      const arg = argumentOf(items, i + 2);
      out.xml(el("func", "", slot("fName", conv(node)) + slot("e", row(items.slice(i + 2, arg)))));
      i = arg - 1;
      continue;
    }
    // `\det B`, `\lim_{x} f`: operator names MathJax gives no U+2061 still take an argument.
    if (next && isOperatorName(node) && !BODY_STOPS.has(opChar(next) ?? "")) {
      const arg = argumentOf(items, i + 1);
      out.xml(el("func", "", slot("fName", conv(node)) + slot("e", row(items.slice(i + 1, arg)))));
      i = arg - 1;
      continue;
    }
    // mhchem writes H_2 as H, then a 2 on a zero-width phantom. Word wants the 2 on the H.
    const spacerBase = /^(msub|msup|msubsup)$/.test(node.localName) && isSpacer(kids(node)[0]);
    if (spacerBase && kids(node).slice(1).every(isInvisible)) continue;
    if (spacerBase && out.hasBase) {
      const [, a, b] = kids(node);
      out.xml(scriptXml(node.localName, out.takeLast(), a, b));
      continue;
    }
    // `{}_a^b X` and mhchem's isotopes: scripts on an empty base before something are pre-scripts.
    if (/^msub|^msup/.test(node.localName) && (spacerBase || isEmpty(kids(node)[0])) && next) {
      const [, a, b] = kids(node);
      const sub = node.localName === "msup" ? undefined : a;
      const sup = node.localName === "msub" ? undefined : node.localName === "msup" ? a : b;
      out.xml(el("sPre", "", slot("sub", sub ? conv(sub) : "") + slot("sup", sup ? conv(sup) : "") + slot("e", conv(next))));
      i++;
      continue;
    }
    token(node, out);
  }
  return out.toString();
}

/** `\det`, `\max`, or `\lim` with its limits: a word MathJax sets as an operator. */
function isOperatorName(node: Element): boolean {
  let n = core(node);
  if (/^(munder|munderover|msub|msubsup)$/.test(n.localName)) n = core(kids(n)[0]);
  const t = text(n);
  return n.localName === "mo" && n.getAttribute("data-mjx-texclass") === "OP" && /^\p{L}+$/u.test(t);
}

/** Where a function's argument ends: one item, or a whole `( … )` group when one starts there. */
function argumentOf(items: Element[], start: number): number {
  const open = opChar(items[start]);
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}", "|": "|" };
  if (open && pairs[open]) {
    let depth = 0;
    for (let j = start; j < items.length; j++) {
      const c = opChar(items[j]);
      if (c === open && (j === start || open !== pairs[open])) depth++;
      else if (c === pairs[open]) {
        depth--;
        if (depth === 0 || open === pairs[open]) return j + 1;
      }
    }
  }
  return Math.min(start + 1, items.length);
}

function naryXml(nary: { op: string; sub?: Element; sup?: Element; under: boolean }, body: string) {
  const props =
    val("chr", nary.op) +
    val("limLoc", nary.under ? "undOvr" : "subSup") +
    (nary.sub ? "" : val("subHide", "1")) +
    (nary.sup ? "" : val("supHide", "1"));
  return el(
    "nary",
    props,
    slot("sub", nary.sub ? conv(nary.sub) : "") + slot("sup", nary.sup ? conv(nary.sup) : "") + slot("e", body),
  );
}

/** One element written into a row. Plain text goes through `out` so runs merge. */
function token(node: Element, out: Out) {
  const name = node.localName;
  switch (name) {
    case "mi": {
      const t = text(node);
      const variant = node.getAttribute("mathvariant");
      const style = variant ? (VARIANTS[variant] ?? {}) : [...t].length > 1 ? { style: "p" as const } : {};
      // Styles only change letters; Word ignores them on digits and symbols anyway.
      out.text(t, isLetter(t) ? style : {});
      return;
    }
    case "mn":
      out.text(text(node), VARIANTS[node.getAttribute("mathvariant") ?? ""]?.style === "b" ? { style: "b" } : {});
      return;
    case "mo": {
      const t = [...text(node)].map((ch) => MHCHEM_ARROWS[ch] ?? ch).join("");
      if (INVISIBLE.has(t)) return;
      out.text(t, isLetter(t) ? { style: "p" } : {});
      return;
    }
    case "mtext":
    case "ms":
      out.text(text(node), { normal: true, style: "p" });
      return;
    case "mspace":
      out.text(spaceFor(node.getAttribute("width")));
      return;
    case "merror":
      out.text(text(node), { normal: true, style: "p" });
      return;
    default:
      out.xml(conv(node));
  }
}

function spaceFor(width: string | null): string {
  const em = parseFloat(width ?? "0");
  if (!(em > 0)) return "";
  if (em >= 1.9) return "  ";
  if (em >= 0.9) return " ";
  if (em >= 0.45) return " ";
  if (em >= 0.2) return " ";
  return " ";
}

/** One element as OMML. */
function conv(node: Element): string {
  const name = node.localName;
  const c = kids(node);
  switch (name) {
    case "math":
    case "mstyle":
    case "semantics":
    case "maction":
      return name === "semantics" || name === "maction" ? (c[0] ? conv(c[0]) : "") : row(c);
    case "mrow":
      return mrow(node);
    case "mpadded":
      // Zero-width phantoms only align chemistry's scripts; Word lines them up itself.
      return isSpacer(node) ? "" : row(c);
    case "mfrac": {
      const lt = node.getAttribute("linethickness");
      const noBar = lt !== null && parseFloat(lt) === 0;
      const props = noBar ? val("type", "noBar") : node.getAttribute("bevelled") === "true" ? val("type", "skw") : "";
      return el("f", props, slot("num", conv(c[0])) + slot("den", c[1] ? conv(c[1]) : ""));
    }
    case "msqrt":
      return el("rad", val("degHide", "1"), slot("deg", "") + slot("e", row(c)));
    case "mroot":
      return el("rad", "", slot("deg", c[1] ? conv(c[1]) : "") + slot("e", conv(c[0])));
    case "msub":
    case "msup":
    case "msubsup":
    case "munder":
    case "mover":
    case "munderover":
      return scripts(node);
    case "mtable":
      return table(node, null);
    case "menclose":
      return enclose(node);
    case "mphantom": {
      // Word's phantom shows its content unless told not to. mhchem wraps one in width 0.
      const parent = node.parentElement;
      const zeroWidth = parent?.localName === "mpadded" && parseFloat(parent.getAttribute("width") ?? "1") === 0;
      return el("phant", val("show", "0") + (zeroWidth ? val("zeroWid", "1") : ""), slot("e", row(c)));
    }
    case "mmultiscripts":
      return multiscripts(node);
    case "mi":
    case "mn":
    case "mo":
    case "mtext":
    case "ms":
    case "mspace":
    case "merror": {
      const out = new Out();
      token(node, out);
      return out.toString();
    }
    case "none":
    case "mprescripts":
      return "";
    default:
      return row(c);
  }
}

function mrow(node: Element): string {
  const c = kids(node);
  const open = fenceChar(c[0], "OPEN");
  const close = fenceChar(c[c.length - 1], "CLOSE");
  if (open === null || close === null || c.length < 2) return row(c);
  const inner = c.slice(1, -1);
  // `\middle|` leaves an empty CLOSE mrow, the bar, and an empty OPEN mrow.
  const parts: Element[][] = [[]];
  let sep: string | null = null;
  for (let i = 0; i < inner.length; i++) {
    const n = inner[i];
    if (
      n.localName === "mrow" &&
      n.getAttribute("data-mjx-texclass") === "CLOSE" &&
      n.children.length === 0 &&
      inner[i + 1]?.localName === "mo" &&
      inner[i + 2]?.getAttribute("data-mjx-texclass") === "OPEN"
    ) {
      sep = text(inner[i + 1]).trim();
      parts.push([]);
      i += 2;
      continue;
    }
    parts[parts.length - 1].push(n);
  }
  // A matrix in brackets: `pmatrix`, `bmatrix`, `cases` … Word keeps the brackets as a delimiter.
  const props =
    (open === "(" ? "" : val("begChr", open)) +
    (sep && sep !== "|" ? val("sepChr", sep) : "") +
    (close === ")" ? "" : val("endChr", close));
  const env = envOf(node);
  const body = parts.map((p) =>
    slot("e", p.length === 1 && core(p[0]).localName === "mtable" ? table(core(p[0]), env) : row(p)),
  );
  return el("d", props, body.join(""));
}

function envOf(node: Element): string | null {
  const latex = node.getAttribute("data-latex") ?? "";
  return /^\\begin\{([a-zA-Z]+\*?)\}/.exec(latex)?.[1] ?? null;
}

/** Nothing that shows: a phantom, perhaps padded, or a row of them. */
function isInvisible(node: Element): boolean {
  const n = core(node);
  if (n.localName === "mphantom") return true;
  if (n.localName === "mpadded" || n.localName === "mrow") return kids(n).length > 0 && kids(n).every(isInvisible);
  return isEmpty(n);
}

/** A phantom of no width, as mhchem puts under its subscripts. */
function isSpacer(node: Element | undefined): boolean {
  const n = node ? core(node) : undefined;
  const inner = n?.children.length === 1 ? core(n.children[0]) : undefined;
  return n?.localName === "mpadded" && parseFloat(n.getAttribute("width") ?? "1") === 0 && inner?.localName === "mphantom";
}

function scriptXml(name: string, base: string, a: Element, b?: Element): string {
  if (name === "msub") return el("sSub", "", slot("e", base) + slot("sub", conv(a)));
  if (name === "msup") return el("sSup", "", slot("e", base) + slot("sup", conv(a)));
  return el("sSubSup", "", slot("e", base) + slot("sub", conv(a)) + slot("sup", b ? conv(b) : ""));
}

function scripts(node: Element): string {
  const name = node.localName;
  const c = kids(node);
  const nary = naryParts(node);
  if (nary) return naryXml(nary, "");
  if (name === "msub" || name === "msup" || name === "msubsup") return scriptXml(name, conv(c[0]), c[1], c[2]);
  if (name === "munderover") {
    const lower = el("limLow", "", slot("e", conv(c[0])) + slot("lim", conv(c[1])));
    return el("limUpp", "", slot("e", lower) + slot("lim", conv(c[2])));
  }
  const top = name === "mover";
  const mark = opChar(c[1]);
  if (mark !== null) {
    if (GROUP_CHARS.has(mark)) {
      return el(
        "groupChr",
        val("chr", mark) + val("pos", top ? "top" : "bot") + val("vertJc", top ? "bot" : "top"),
        slot("e", conv(c[0])),
      );
    }
    if (BARS.has(mark) && core(c[1]).getAttribute("stretchy") !== "false") {
      return el("bar", val("pos", top ? "top" : "bot"), slot("e", conv(c[0])));
    }
    if (top && ACCENTS[mark] && !isLargeOp(c[0])) {
      const chr = ACCENTS[mark];
      return el("acc", chr === "̂" ? "" : val("chr", chr), slot("e", conv(c[0])));
    }
  }
  return el(top ? "limUpp" : "limLow", "", slot("e", conv(c[0])) + slot("lim", conv(c[1])));
}

function table(node: Element, env: string | null): string {
  const rows = kids(node).filter((r) => r.localName === "mtr" || r.localName === "mlabeledtr");
  const cells = rows.map((r) => {
    const all = kids(r).filter((d) => d.localName === "mtd");
    return r.localName === "mlabeledtr" ? { cells: all.slice(1), label: all[0] } : { cells: all, label: undefined };
  });
  const ownEnv = env ?? envOf(node);
  // `align` and its family set displaystyle; matrices don't.
  const matrix = ownEnv ? MATRIX_ENVS.test(ownEnv) : node.getAttribute("displaystyle") !== "true";
  const label = (l?: Element) => (l ? run(" " + text(l)) : "");
  // One cell, as `x \tag{1}` gives: no table at all.
  if (cells.length === 1 && cells[0].cells.length === 1) return row(kids(cells[0].cells[0])) + label(cells[0].label);
  if (matrix) {
    const width = Math.max(1, ...cells.map((r) => r.cells.length));
    const mcs = `<m:mcs><m:mc><m:mcPr>${val("count", String(width))}${val("mcJc", "center")}</m:mcPr></m:mc></m:mcs>`;
    const mr = cells.map(({ cells: rc }) => {
      const padded = [...rc.map((d) => slot("e", row(kids(d))))];
      while (padded.length < width) padded.push(slot("e", ""));
      return `<m:mr>${padded.join("")}</m:mr>`;
    });
    return el("m", mcs, mr.join(""));
  }
  // Aligned lines: Word marks each alignment point with a literal `&`, as LaTeX does.
  const lines = cells.map(({ cells: rc, label: l }) => {
    const parts = rc.map((d) => row(kids(d).filter((k) => !(k.localName === "mi" && isEmpty(k)))));
    return slot("e", parts.join(run("&")) + label(l));
  });
  return el("eqArr", "", lines.join(""));
}

function enclose(node: Element): string {
  const notation = (node.getAttribute("notation") ?? "").split(/\s+/);
  const body = slot("e", row(kids(node)));
  if (notation.some((n) => n === "box" || n === "roundedbox")) return el("borderBox", "", body);
  const up = notation.includes("updiagonalstrike");
  const down = notation.includes("downdiagonalstrike");
  const across = notation.includes("horizontalstrike");
  if (!up && !down && !across) return row(kids(node));
  const hidden = ["hideTop", "hideBot", "hideLeft", "hideRight"].map((h) => val(h, "1")).join("");
  const strikes = (across ? val("strikeH", "1") : "") + (up ? val("strikeBLTR", "1") : "") + (down ? val("strikeTLBR", "1") : "");
  return el("borderBox", hidden + strikes, body);
}

function multiscripts(node: Element): string {
  const c = kids(node);
  const split = c.findIndex((k) => k.localName === "mprescripts");
  const post = split < 0 ? c.slice(1) : c.slice(1, split);
  const pre = split < 0 ? [] : c.slice(split + 1);
  let base = conv(c[0]);
  if (post.length >= 2) {
    base = el("sSubSup", "", slot("e", base) + slot("sub", conv(post[0])) + slot("sup", conv(post[1])));
  }
  if (pre.length >= 2) {
    return el("sPre", "", slot("sub", conv(pre[0])) + slot("sup", conv(pre[1])) + slot("e", base));
  }
  return base;
}
