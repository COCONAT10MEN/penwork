// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { texToMathml, texToSvg } from "./mathjax";
import { mathmlToOmml } from "./mathmlToOmml";
import { ommlToLatex } from "./ommlToLatex";

const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml").documentElement;

function toOmml(latex: string, display = false): string {
  const mml = texToMathml(latex, display);
  if (!mml.ok) throw new Error(mml.error);
  return mathmlToOmml(parse(mml.value), display);
}

/** OMML reduced to its structure and text, so two equations compare by what they show. */
function shape(omml: string): string {
  return omml.replace(/ xmlns:\w+="[^"]*"/g, "").replace(/<w:rPr>.*?<\/w:rPr>/g, "");
}

const CORPUS = [
  String.raw`\frac{a}{b}+\sqrt[3]{x^2}`,
  String.raw`x_i^2 + y_{j,k}`,
  String.raw`\sqrt{b^2-4ac}`,
  String.raw`\sum_{i=1}^{n} i^2 = \frac{n(n+1)(2n+1)}{6}`,
  String.raw`\int_0^1 f(x)\,dx`,
  String.raw`\prod_{k} a_k`,
  String.raw`\oint_C \mathbf{F}\cdot d\mathbf{r}`,
  String.raw`\lim_{n\to\infty} \left(1+\frac{1}{n}\right)^n = e`,
  String.raw`\sin x + \cos(2\theta) + \log_2 n`,
  String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}`,
  String.raw`\begin{bmatrix}1&0&0\\0&1&0\end{bmatrix}`,
  String.raw`\begin{vmatrix}a&b\\c&d\end{vmatrix}`,
  String.raw`f(x)=\begin{cases}1 & x>0\\0 & \text{otherwise}\end{cases}`,
  String.raw`\hat{x}+\tilde{y}+\vec{v}+\dot{a}+\ddot{b}+\bar{z}`,
  String.raw`\overline{AB}+\underline{c}`,
  String.raw`\overbrace{a+b}^{n}+\underbrace{c+d}_{m}`,
  String.raw`\binom{n}{k}`,
  String.raw`\alpha\beta\gamma\Delta\Omega + \infty \le \pi`,
  String.raw`\mathbb{R}\subseteq\mathbb{C}, \mathcal{L}, \mathfrak{g}, \mathbf{v}`,
  String.raw`\left\{ x \in \mathbb{R} \middle| x > 0 \right\}`,
  String.raw`\left\langle u, v \right\rangle`,
  String.raw`\boxed{E=mc^2}`,
  String.raw`a \ne b, a \approx b, a \equiv b \pmod{n}`,
  String.raw`\forall x \exists y: x \to y \Rightarrow z`,
  String.raw`{}_a^b X`,
  String.raw`\nabla \times \mathbf{E} = -\frac{\partial \mathbf{B}}{\partial t}`,
  String.raw`\overset{!}{=}`,
  String.raw`\operatorname{tr} A + \det B`,
  String.raw`\int\limits_0^1 x\,dx + \iint_D f\,dA`,
  String.raw`\cancel{x} + \text{if } x > 0`,
  String.raw`\left| x \right| + \left\lVert v \right\rVert`,
  String.raw`\left. \frac{df}{dx} \right|_{x=0}`,
  String.raw`\sqrt[n]{1+x} \cdot \frac{\partial^2 u}{\partial x^2}`,
  String.raw`\mathrm{d}x \, e^{-i\omega t}`,
  String.raw`\max_{x \in S} f(x)`,
];

describe("everything MathJax reads becomes some Word equation", () => {
  it.each([
    String.raw`\ce{H2O + CO2 -> H2CO3}`,
    String.raw`\xrightarrow[below]{above}`,
    String.raw`\color{red}{x} + \bbox[5px]{y}`,
    String.raw`\begin{align} a &= b \tag{1} \\ c &= d \end{align}`,
    String.raw`\begin{array}{cc} 1 & 2 \\ 3 & 4 \end{array}`,
    String.raw`\newcommand{\R}{\mathbb{R}} \R^n`,
    String.raw`\begin{gathered} a \\ bb \end{gathered}`,
    String.raw`\uppi \ne \pi, 30\degree`,
  ])("%s", (latex) => {
    const omml = toOmml(latex, true);
    expect(omml).toContain("<m:oMath>");
    expect(() => ommlToLatex(parse(omml))).not.toThrow();
  });
});

describe("LaTeX to a Word equation and back", () => {
  it.each(CORPUS)("%s", (latex) => {
    const first = toOmml(latex);
    const back = ommlToLatex(parse(first));
    const second = toOmml(back);
    expect(shape(second)).toBe(shape(first));
  });

  it("keeps aligned lines as Word's equation array with & marks", () => {
    const latex = String.raw`\begin{aligned}x&=1\\y&=2\end{aligned}`;
    const omml = toOmml(latex, true);
    expect(omml).toContain("<m:oMathPara");
    expect(omml).toContain("<m:eqArr>");
    expect(shape(omml)).toContain("<m:t>x</m:t></m:r><m:r><m:t>&amp;</m:t></m:r><m:r><m:t>=1</m:t>");
    expect(ommlToLatex(parse(omml))).toBe(String.raw`\begin{aligned}x&=1\\y&=2\end{aligned}`);
  });

  it("writes a bracketed matrix as a delimiter around a matrix, as Word does", () => {
    const omml = shape(toOmml(String.raw`\begin{bmatrix}a&b\\c&d\end{bmatrix}`));
    expect(omml).toContain('<m:begChr m:val="["/>');
    expect(omml).toContain("<m:m><m:mPr><m:mcs>");
    expect(omml).toContain('<m:count m:val="2"/>');
  });

  it("gives a function its argument", () => {
    const omml = shape(toOmml(String.raw`\sin x`));
    expect(omml).toContain("<m:func><m:fName><m:r><m:rPr><m:sty m:val=\"p\"/></m:rPr><m:t>sin</m:t>");
    expect(ommlToLatex(parse(toOmml(String.raw`\sin x`)))).toBe(String.raw`\sin x`);
  });

  it("puts the body of a sum inside the sum, up to the next relation", () => {
    const omml = shape(toOmml(String.raw`\sum_{i=1}^n a_i = S`));
    expect(omml).toMatch(/<m:e><m:sSub>.*<\/m:sSub><\/m:e><\/m:nary><m:r><m:t>=S<\/m:t>/);
  });

  it("reads Word's own OMML", () => {
    // As Word itself saved `lim_(n→∞) a_n` and an accent with no m:chr (a hat).
    const word = `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><m:func><m:funcPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math"/></w:rPr></m:ctrlPr></m:funcPr><m:fName><m:limLow><m:e><m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>lim</m:t></m:r></m:e><m:lim><m:r><m:t>n</m:t></m:r><m:r><m:t>→∞</m:t></m:r></m:lim></m:limLow></m:fName><m:e><m:sSub><m:e><m:r><m:t>a</m:t></m:r></m:e><m:sub><m:r><m:t>n</m:t></m:r></m:sub></m:sSub></m:e></m:func><m:acc><m:e><m:r><m:t>a</m:t></m:r></m:e></m:acc></m:oMath>`;
    expect(ommlToLatex(parse(word))).toBe(String.raw`\lim_{n\to\infty}{a_n}\hat{a}`);
  });

  it("puts chemistry subscripts on their element, with no hidden spacer", () => {
    const omml = shape(toOmml(String.raw`\ce{H2O}`));
    expect(omml).toMatch(/<m:sSub><m:e><m:r><m:rPr>.*?<\/m:rPr><m:t>H<\/m:t><\/m:r><\/m:e><m:sub>/);
    expect(omml).not.toContain("<m:phant>");
  });

  it("gives \\det and \\lim their argument, as Word's functions", () => {
    expect(shape(toOmml(String.raw`\det B`))).toContain("<m:func>");
    expect(shape(toOmml(String.raw`\lim_{x\to 0} f`))).toContain("<m:func><m:fName><m:limLow>");
  });

  it("reports a LaTeX mistake instead of drawing it", () => {
    const result = texToMathml(String.raw`\frac{`, false);
    expect(result.ok).toBe(false);
  });

  it("draws one picture with its size and baseline", async () => {
    const result = await texToSvg(String.raw`\frac{a}{b}+\sqrt[3]{x^2}`, false);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg.match(/<svg/g)).toHaveLength(1);
    expect(result.value.depth).toBeGreaterThan(0.3);
    expect(result.value.width).toBeGreaterThan(result.value.height);
  });

  it("loads extra font parts, such as double-struck letters, from the app", async () => {
    const result = await texToSvg(String.raw`\mathbb{R}\mathfrak{g}`, false);
    expect(result.ok).toBe(true);
  });
});
