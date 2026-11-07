/**
 * Office Math (OMML) to LaTeX, so an equation made in Word opens as LaTeX the user can edit.
 *
 * It walks Word's structures (fractions, scripts, n-ary operators, matrices, …) and writes the
 * LaTeX that MathJax reads back into the same structure.
 */
import { OMML_NS } from "./omml";
import { ACCENT_COMMANDS, DELIMITERS, FUNCTIONS, LETTERLIKE, NARY, SYMBOLS } from "./symbols";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const isMath = (n: Element, name?: string) => n.namespaceURI === OMML_NS && (!name || n.localName === name);
const mkids = (n: Element) => Array.from(n.children).filter((c) => isMath(c));
const child = (n: Element, name: string) => mkids(n).find((c) => c.localName === name);

/** A property value such as `m:chr/@m:val`, read from the element's `…Pr` block. */
function prop(n: Element, name: string): string | null {
  const pr = child(n, `${n.localName}Pr`);
  const p = pr ? mkids(pr).find((c) => c.localName === name) : undefined;
  if (!p) return null;
  return p.getAttributeNS(OMML_NS, "val") ?? p.getAttribute("m:val") ?? "";
}

const on = (value: string | null) => value !== null && value !== "0" && value !== "off" && value !== "false";

/** Joins LaTeX pieces, keeping a command like `\alpha` apart from a letter after it. */
function join(parts: string[]): string {
  let out = "";
  for (const part of parts) {
    if (!part) continue;
    if (/\\[a-zA-Z]+$/.test(out) && /^[a-zA-Z0-9]/.test(part)) out += " ";
    out += part;
  }
  return out;
}

/** Braces around anything longer than one character, as a script or argument needs. */
function group(latex: string): string {
  if ([...latex].length === 1 || /^\\[a-zA-Z]+$/.test(latex)) return latex;
  return `{${latex}}`;
}

export function ommlToLatex(node: Element): string {
  if (isMath(node, "oMathPara")) {
    const lines = mkids(node).filter((c) => c.localName === "oMath").map((m) => body(m));
    return lines.length > 1 ? `\\begin{gathered}${lines.join("\\\\")}\\end{gathered}` : (lines[0] ?? "");
  }
  return body(node).trim();
}

/** The contents of a slot such as `m:e`, `m:num` or `m:oMath`. */
function body(n: Element | undefined): string {
  if (!n) return "";
  return join(Array.from(n.children).map(convert));
}

function convert(n: Element): string {
  if (!isMath(n)) {
    // Word puts runs, bookmarks and tracked changes beside the math; only text-bearing ones count.
    if (n.namespaceURI === W_NS && (n.localName === "ins" || n.localName === "smartTag")) return body(n);
    return "";
  }
  switch (n.localName) {
    case "r":
      return runText(n);
    case "f":
      return fraction(n);
    case "rad": {
      const deg = body(child(n, "deg"));
      const inside = body(child(n, "e"));
      return on(prop(n, "degHide")) || !deg ? `\\sqrt{${inside}}` : `\\sqrt[${deg}]{${inside}}`;
    }
    case "sSub":
      return `${base(n)}_${group(body(child(n, "sub")))}`;
    case "sSup":
      return `${base(n)}^${group(body(child(n, "sup")))}`;
    case "sSubSup":
      return `${base(n)}_${group(body(child(n, "sub")))}^${group(body(child(n, "sup")))}`;
    case "sPre":
      return `{}_${group(body(child(n, "sub")))}^${group(body(child(n, "sup")))}${group(body(child(n, "e")))}`;
    case "nary":
      return nary(n);
    case "d":
      return delimiter(n);
    case "m":
      return `\\begin{matrix}${matrixRows(n)}\\end{matrix}`;
    case "eqArr":
      return eqArr(n);
    case "acc": {
      const chr = prop(n, "chr") ?? "̂";
      const cmd = ACCENT_COMMANDS[chr];
      const inside = body(child(n, "e"));
      if (cmd) return `${wide(cmd, inside)}{${inside}}`;
      return `\\overset{${symbol(chr)}}{${inside}}`;
    }
    case "bar":
      return prop(n, "pos") === "top" ? `\\overline{${body(child(n, "e"))}}` : `\\underline{${body(child(n, "e"))}}`;
    case "groupChr":
      return groupChr(n);
    case "limLow":
      return limit(n, "_");
    case "limUpp":
      return limit(n, "^");
    case "func":
      return func(n);
    case "borderBox":
      return borderBox(n);
    case "box":
    case "e":
    case "oMath":
      return body(n.localName === "box" ? child(n, "e") : n);
    case "phant": {
      const inside = body(child(n, "e"));
      // Without m:show off, Word's phantom is visible: it only adjusts spacing.
      if (!(prop(n, "show") === "0" || prop(n, "show") === "off")) return inside;
      return on(prop(n, "zeroWid")) ? `\\mathrlap{\\phantom{${inside}}}` : `\\phantom{${inside}}`;
    }
    default:
      // Unknown or property elements: keep any equation text inside them.
      return n.localName.endsWith("Pr") ? "" : join(mkids(n).map(convert));
  }
}

function base(n: Element): string {
  const b = body(child(n, "e"));
  return b === "" ? "{}" : group(b);
}

function wide(cmd: string, inside: string): string {
  if ([...inside].length <= 1) return cmd;
  return cmd === "\\hat" ? "\\widehat" : cmd === "\\tilde" ? "\\widetilde" : cmd === "\\vec" ? "\\overrightarrow" : cmd;
}

function fraction(n: Element): string {
  const num = body(child(n, "num"));
  const den = body(child(n, "den"));
  switch (prop(n, "type")) {
    case "noBar":
      return `\\genfrac{}{}{0pt}{}{${num}}{${den}}`;
    case "lin":
    case "skw":
      return `${group(num)}/${group(den)}`;
    default:
      return `\\frac{${num}}{${den}}`;
  }
}

function nary(n: Element): string {
  const chr = prop(n, "chr") ?? "∫";
  const cmd = NARY[chr] ?? symbol(chr);
  const integral = ["∫", "∬", "∭", "∮", "∯", "∰"].includes(chr);
  const loc = prop(n, "limLoc");
  const limits = loc === "undOvr" && integral ? "\\limits" : loc === "subSup" && !integral ? "\\nolimits" : "";
  const sub = on(prop(n, "subHide")) ? "" : body(child(n, "sub"));
  const sup = on(prop(n, "supHide")) ? "" : body(child(n, "sup"));
  const head = cmd + limits + (sub ? `_${group(sub)}` : "") + (sup ? `^${group(sup)}` : "");
  return join([head, body(child(n, "e"))]);
}

const MATRIX_BRACKETS: Record<string, string> = {
  "()": "pmatrix",
  "[]": "bmatrix",
  "{}": "Bmatrix",
  "||": "vmatrix",
  "‖‖": "Vmatrix",
};

function delimiter(n: Element): string {
  const open = prop(n, "begChr") ?? "(";
  const close = prop(n, "endChr") ?? ")";
  const sep = prop(n, "sepChr") ?? "|";
  const parts = mkids(n).filter((c) => c.localName === "e");
  // `\binom` and the bracketed matrix environments read better than \left … \right.
  if (parts.length === 1) {
    const only = mkids(parts[0]);
    const inner = only.length === 1 ? only[0] : undefined;
    if (inner?.localName === "m" && MATRIX_BRACKETS[open + close]) {
      const env = MATRIX_BRACKETS[open + close];
      return `\\begin{${env}}${matrixRows(inner)}\\end{${env}}`;
    }
    if (inner?.localName === "eqArr" && open === "{" && close === "") {
      return `\\begin{cases}${rows(inner)}\\end{cases}`;
    }
    if (inner?.localName === "f" && prop(inner, "type") === "noBar" && open === "(" && close === ")") {
      return `\\binom{${body(child(inner, "num"))}}{${body(child(inner, "den"))}}`;
    }
  }
  const middle = ` \\middle${DELIMITERS[sep] ?? "|"} `;
  return join([`\\left${DELIMITERS[open] ?? "."}`, parts.map(body).join(middle), `\\right${DELIMITERS[close] ?? "."}`]);
}

function matrixRows(n: Element): string {
  return mkids(n)
    .filter((r) => r.localName === "mr")
    .map((r) => mkids(r).filter((c) => c.localName === "e").map(body).join("&"))
    .join("\\\\");
}

/** Inside an equation array a `&` is an alignment mark, not an ampersand. */
let aligning = 0;

/** Lines of an `m:eqArr`; Word's `&` alignment marks are already LaTeX's. */
function rows(n: Element): string {
  aligning++;
  try {
    return mkids(n)
      .filter((c) => c.localName === "e")
      .map(body)
      .join("\\\\");
  } finally {
    aligning--;
  }
}

function eqArr(n: Element): string {
  const text = rows(n);
  return text.includes("&") ? `\\begin{aligned}${text}\\end{aligned}` : `\\begin{gathered}${text}\\end{gathered}`;
}

function groupChr(n: Element): string {
  const chr = prop(n, "chr") ?? "⏟";
  const top = prop(n, "pos") === "top";
  const inside = body(child(n, "e"));
  if (chr === "⏞" || chr === "⏜" || chr === "⎴") return `\\overbrace{${inside}}`;
  if (chr === "⏟" || chr === "⏝" || chr === "⎵") return `\\underbrace{${inside}}`;
  return top ? `\\overset{${symbol(chr)}}{${inside}}` : `\\underset{${symbol(chr)}}{${inside}}`;
}

function limit(n: Element, mark: "_" | "^"): string {
  const e = child(n, "e");
  const lim = body(child(n, "lim"));
  const inner = e && mkids(e).length === 1 ? mkids(e)[0] : undefined;
  const top = body(e);
  // `\underbrace{x}_{n}` is stored as a brace inside a limit.
  if (inner?.localName === "groupChr") return `${groupChr(inner)}${mark}{${lim}}`;
  if (/^\\[a-zA-Z]+$/.test(top) && (FUNCTIONS.has(top.slice(1)) || top.startsWith("\\operatorname"))) {
    return `${top}${mark}{${lim}}`;
  }
  const word = /^\\mathrm\{([a-zA-Z]+)\}$/.exec(top);
  if (word) return `\\operatorname*{${word[1]}}${mark}{${lim}}`;
  return mark === "_" ? `\\underset{${lim}}{${top}}` : `\\overset{${lim}}{${top}}`;
}

function func(n: Element): string {
  // A name LaTeX has no command for still needs to read as a function: `\operatorname`.
  const name = body(child(n, "fName")).replace(/^\\mathrm\{([a-zA-Z]+)\}/, "\\operatorname{$1}");
  const arg = body(child(n, "e"));
  const simple = /^[a-zA-Z0-9]$/.test(arg) || /^\\[a-zA-Z]+$/.test(arg);
  return simple ? join([name, arg.startsWith("\\") ? arg : ` ${arg}`]) : `${name}{${arg}}`;
}

function borderBox(n: Element): string {
  const inside = body(child(n, "e"));
  const hidden = ["hideTop", "hideBot", "hideLeft", "hideRight"].every((h) => on(prop(n, h)));
  const up = on(prop(n, "strikeBLTR"));
  const down = on(prop(n, "strikeTLBR"));
  if (hidden && up && down) return `\\xcancel{${inside}}`;
  if (hidden && up) return `\\cancel{${inside}}`;
  if (hidden && down) return `\\bcancel{${inside}}`;
  if (hidden) return inside;
  return `\\boxed{${inside}}`;
}

/** Text of one `m:r`, with its style: upright, bold, double-struck, ordinary text … */
function runText(r: Element): string {
  const t = Array.from(r.children)
    .map((c) => (c.localName === "t" ? (c.textContent ?? "") : c.localName === "br" ? "" : c.localName === "tab" ? " " : ""))
    .join("");
  if (!t) return "";
  const rPr = child(r, "rPr");
  const read = (name: string) => {
    const p = rPr ? mkids(rPr).find((c) => c.localName === name) : undefined;
    return p ? (p.getAttributeNS(OMML_NS, "val") ?? p.getAttribute("m:val") ?? "") : null;
  };
  if (read("nor") !== null && on(read("nor") || "1")) return `\\text{${textEscape(t)}}`;
  const scr = read("scr");
  const sty = read("sty");
  return styled(t, scr, sty);
}

function textEscape(t: string): string {
  return t.replace(/[\\{}$&#%_^~]/g, (c) => (c === "\\" ? "\\backslash " : `\\${c}`));
}

const FONT_COMMANDS: Record<string, string> = {
  "double-struck": "\\mathbb",
  script: "\\mathcal",
  fraktur: "\\mathfrak",
  "sans-serif": "\\mathsf",
  monospace: "\\mathtt",
};

function styled(t: string, scr: string | null, sty: string | null): string {
  const font = scr ? FONT_COMMANDS[scr] : undefined;
  if (font) {
    const inner = plain(t, true);
    return sty === "b" || sty === "bi" ? `\\boldsymbol{${font}{${inner}}}` : `${font}{${inner}}`;
  }
  if (sty === "b") return /^[\p{L}\p{N}]+$/u.test(t) ? `\\mathbf{${plain(t, true)}}` : `\\boldsymbol{${plain(t, false)}}`;
  if (sty === "bi") return `\\boldsymbol{${plain(t, false)}}`;
  if (sty === "p") return upright(t);
  return plain(t, false);
}

/** Upright letters: a known function name becomes `\sin`, other words `\mathrm{…}`. */
function upright(t: string): string {
  const out: string[] = [];
  for (const piece of t.match(/[A-Za-z]+|[^A-Za-z]+/g) ?? []) {
    if (/^[A-Za-z]+$/.test(piece)) {
      out.push(FUNCTIONS.has(piece) ? `\\${piece}` : `\\mathrm{${piece}}`);
    } else {
      out.push(plain(piece, false));
    }
  }
  return join(out);
}

/** Characters as LaTeX. `bare` keeps letters as they are, for inside `\mathbb{}` and friends. */
function plain(t: string, bare: boolean): string {
  const out: string[] = [];
  for (const ch of t) {
    const alpha = mathAlphanumeric(ch);
    if (alpha) out.push(bare ? alpha.letter : alpha.latex);
    else if (LETTERLIKE[ch]) out.push(bare ? ch : LETTERLIKE[ch]);
    else out.push(ch === "&" && aligning > 0 ? "&" : symbol(ch));
  }
  return join(out);
}

function symbol(ch: string): string {
  if (SYMBOLS[ch] !== undefined) return SYMBOLS[ch];
  if (/[A-Za-z0-9 ()[\]+\-=<>/*!?.,;:|'@"]/.test(ch)) return ch === " " ? "" : ch;
  return ch;
}

/** Word rarely, but other tools often, store styled letters as Unicode math alphanumerics. */
const ALPHA_BLOCKS: [number, string][] = [
  [0x1d400, "\\mathbf"], [0x1d434, ""], [0x1d468, "\\boldsymbol"], [0x1d49c, "\\mathcal"],
  [0x1d4d0, "\\mathcal"], [0x1d504, "\\mathfrak"], [0x1d538, "\\mathbb"], [0x1d56c, "\\mathfrak"],
  [0x1d5a0, "\\mathsf"], [0x1d5d4, "\\mathsf"], [0x1d608, "\\mathsf"], [0x1d63c, "\\mathsf"],
  [0x1d670, "\\mathtt"],
];
const DIGIT_BLOCKS: [number, string][] = [
  [0x1d7ce, "\\mathbf"], [0x1d7d8, "\\mathbb"], [0x1d7e2, "\\mathsf"], [0x1d7ec, "\\mathsf"], [0x1d7f6, "\\mathtt"],
];

function mathAlphanumeric(ch: string): { letter: string; latex: string } | null {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp === 0x210e) return { letter: "h", latex: "h" };
  for (const [start, cmd] of ALPHA_BLOCKS) {
    if (cp >= start && cp < start + 52) {
      const i = cp - start;
      const letter = String.fromCharCode(i < 26 ? 65 + i : 97 + i - 26);
      return { letter, latex: cmd ? `${cmd}{${letter}}` : letter };
    }
  }
  for (const [start, cmd] of DIGIT_BLOCKS) {
    if (cp >= start && cp < start + 10) {
      const letter = String(cp - start);
      return { letter, latex: `${cmd}{${letter}}` };
    }
  }
  return null;
}
