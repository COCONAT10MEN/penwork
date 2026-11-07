/** Unicode characters in Word equations and the LaTeX that writes them. */
export const SYMBOLS: Record<string, string> = {
  // Greek
  α: "\\alpha", β: "\\beta", γ: "\\gamma", δ: "\\delta", ε: "\\epsilon", ϵ: "\\epsilon",
  ζ: "\\zeta", η: "\\eta", θ: "\\theta", ϑ: "\\vartheta", ι: "\\iota", κ: "\\kappa", λ: "\\lambda",
  μ: "\\mu", ν: "\\nu", ξ: "\\xi", π: "\\pi", ϖ: "\\varpi", ρ: "\\rho", ϱ: "\\varrho", σ: "\\sigma",
  ς: "\\varsigma", τ: "\\tau", υ: "\\upsilon", φ: "\\varphi", ϕ: "\\phi", χ: "\\chi", ψ: "\\psi",
  ω: "\\omega", Γ: "\\Gamma", Δ: "\\Delta", Θ: "\\Theta", Λ: "\\Lambda", Ξ: "\\Xi", Π: "\\Pi",
  Σ: "\\Sigma", Υ: "\\Upsilon", Φ: "\\Phi", Ψ: "\\Psi", Ω: "\\Omega", ϝ: "\\digamma", ϰ: "\\varkappa",
  // Relations
  "≤": "\\le", "≥": "\\ge", "≠": "\\ne", "≈": "\\approx", "≡": "\\equiv", "∼": "\\sim", "≃": "\\simeq",
  "≅": "\\cong", "∝": "\\propto", "≪": "\\ll", "≫": "\\gg", "≺": "\\prec", "≻": "\\succ",
  "⪯": "\\preceq", "⪰": "\\succeq", "∈": "\\in", "∉": "\\notin", "∋": "\\ni", "⊂": "\\subset",
  "⊃": "\\supset", "⊆": "\\subseteq", "⊇": "\\supseteq", "⊊": "\\subsetneq", "⊋": "\\supsetneq",
  "⊄": "\\not\\subset", "⊏": "\\sqsubset", "⊐": "\\sqsupset", "⊑": "\\sqsubseteq", "⊒": "\\sqsupseteq",
  "∣": "\\mid", "∥": "\\parallel", "∦": "\\nparallel", "⊥": "\\perp", "⊢": "\\vdash", "⊣": "\\dashv",
  "⊨": "\\models", "≐": "\\doteq", "≍": "\\asymp", "⋈": "\\bowtie", "≲": "\\lesssim", "≳": "\\gtrsim",
  "≦": "\\leqq", "≧": "\\geqq", "⩽": "\\leqslant", "⩾": "\\geqslant", "≮": "\\nless", "≯": "\\ngtr",
  "≰": "\\nleq", "≱": "\\ngeq", "≔": "\\coloneqq", "≜": "\\triangleq", "∴": "\\therefore", "∵": "\\because",
  // Arrows
  "→": "\\to", "←": "\\leftarrow", "↔": "\\leftrightarrow", "⇒": "\\Rightarrow", "⇐": "\\Leftarrow",
  "⇔": "\\Leftrightarrow", "⟶": "\\longrightarrow", "⟵": "\\longleftarrow", "⟷": "\\longleftrightarrow",
  "⟹": "\\Longrightarrow", "⟸": "\\Longleftarrow", "⟺": "\\iff", "↦": "\\mapsto", "⟼": "\\longmapsto",
  "↑": "\\uparrow", "↓": "\\downarrow", "↕": "\\updownarrow", "⇑": "\\Uparrow", "⇓": "\\Downarrow",
  "↗": "\\nearrow", "↘": "\\searrow", "↙": "\\swarrow", "↖": "\\nwarrow", "↪": "\\hookrightarrow",
  "↩": "\\hookleftarrow", "⇀": "\\rightharpoonup", "↼": "\\leftharpoonup", "⇌": "\\rightleftharpoons",
  "↠": "\\twoheadrightarrow", "↣": "\\rightarrowtail", "⇝": "\\leadsto",
  // Operators
  "±": "\\pm", "∓": "\\mp", "×": "\\times", "÷": "\\div", "⋅": "\\cdot", "·": "\\cdot", "∘": "\\circ",
  "∙": "\\bullet", "∗": "\\ast", "⋆": "\\star", "⊕": "\\oplus", "⊖": "\\ominus", "⊗": "\\otimes",
  "⊘": "\\oslash", "⊙": "\\odot", "∪": "\\cup", "∩": "\\cap", "⊔": "\\sqcup", "⊓": "\\sqcap",
  "∨": "\\lor", "∧": "\\land", "∖": "\\setminus", "≀": "\\wr", "⋄": "\\diamond", "△": "\\triangle",
  "▽": "\\triangledown", "†": "\\dagger", "‡": "\\ddagger", "⨿": "\\amalg", "⊎": "\\uplus", "⊲": "\\lhd",
  "⊳": "\\rhd", "⋉": "\\ltimes", "⋊": "\\rtimes",
  "−": "-", "∕": "/",
  // Misc
  "∞": "\\infty", "∂": "\\partial", "∇": "\\nabla", "∀": "\\forall", "∃": "\\exists", "∄": "\\nexists",
  "∅": "\\emptyset", "¬": "\\neg", "ℵ": "\\aleph", "ℏ": "\\hbar", "ℓ": "\\ell", "℘": "\\wp", "ℜ": "\\Re",
  "ℑ": "\\Im", "′": "'", "″": "''", "‴": "'''", "°": "^{\\circ}", "∠": "\\angle", "∡": "\\measuredangle",
  "…": "\\ldots", "⋯": "\\cdots", "⋮": "\\vdots", "⋱": "\\ddots", "♠": "\\spadesuit", "♣": "\\clubsuit",
  "♡": "\\heartsuit", "♢": "\\diamondsuit", "□": "\\square", "■": "\\blacksquare", "✓": "\\checkmark",
  "⊤": "\\top", "⊥̸": "\\not\\perp", "♭": "\\flat", "♮": "\\natural", "♯": "\\sharp", "ı": "\\imath",
  "ȷ": "\\jmath", "ð": "\\eth", "∎": "\\blacksquare",
  // Delimiters as plain characters
  "⟨": "\\langle", "⟩": "\\rangle", "⌈": "\\lceil", "⌉": "\\rceil", "⌊": "\\lfloor", "⌋": "\\rfloor",
  "‖": "\\|", "{": "\\{", "}": "\\}",
  // Characters LaTeX treats as commands
  "#": "\\#", "%": "\\%", $: "\\$", _: "\\_", "&": "\\&", "\\": "\\backslash", "~": "\\sim", "^": "\\hat{}",
  // Spaces
  " ": "\\,", " ": "\\;", " ": "\\;", " ": "\\ ", " ": "\\quad", " ": "\\ ",
  " ": "\\,", " ": "\\:",
};

/** Big operators, by the character Word stores in `m:chr`. */
export const NARY: Record<string, string> = {
  "∑": "\\sum", "∏": "\\prod", "∐": "\\coprod", "∫": "\\int", "∬": "\\iint", "∭": "\\iiint",
  "∮": "\\oint", "∯": "\\oiint", "∰": "\\oiiint", "⋃": "\\bigcup", "⋂": "\\bigcap", "⋁": "\\bigvee",
  "⋀": "\\bigwedge", "⨁": "\\bigoplus", "⨂": "\\bigotimes", "⨀": "\\bigodot", "⨄": "\\biguplus",
  "⨆": "\\bigsqcup",
};

/** Accents, by the combining character Word stores. */
export const ACCENT_COMMANDS: Record<string, string> = {
  "̂": "\\hat", "̃": "\\tilde", "̄": "\\bar", "̅": "\\bar", "⃗": "\\vec",
  "⃖": "\\overleftarrow", "⃡": "\\overleftrightarrow", "̇": "\\dot", "̈": "\\ddot",
  "⃛": "\\dddot", "̌": "\\check", "̆": "\\breve", "́": "\\acute", "̀": "\\grave",
  "̊": "\\mathring",
};

/** Names LaTeX writes as functions, upright and spaced: `\sin`, `\lim` … */
export const FUNCTIONS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "coth",
  "log", "ln", "lg", "exp", "lim", "liminf", "limsup", "max", "min", "sup", "inf", "det", "dim", "ker",
  "deg", "gcd", "hom", "arg", "Pr",
]);

/** Delimiters `\left` and `\right` can take, by character. */
export const DELIMITERS: Record<string, string> = {
  "(": "(", ")": ")", "[": "[", "]": "]", "{": "\\{", "}": "\\}", "|": "|", "‖": "\\|", "⟨": "\\langle",
  "⟩": "\\rangle", "〈": "\\langle", "〉": "\\rangle", "⌈": "\\lceil", "⌉": "\\rceil", "⌊": "\\lfloor",
  "⌋": "\\rfloor", "/": "/", "\\": "\\backslash", "↑": "\\uparrow", "↓": "\\downarrow", "": ".",
  "⟦": "[\\![", "⟧": "]\\!]",
};

/** Double-struck capitals that have their own Unicode character. */
export const LETTERLIKE: Record<string, string> = {
  ℝ: "\\mathbb{R}", ℕ: "\\mathbb{N}", ℤ: "\\mathbb{Z}", ℚ: "\\mathbb{Q}", ℂ: "\\mathbb{C}",
  ℙ: "\\mathbb{P}", ℍ: "\\mathbb{H}", ℒ: "\\mathcal{L}", ℱ: "\\mathcal{F}", ℋ: "\\mathcal{H}",
  ℐ: "\\mathcal{I}", ℛ: "\\mathcal{R}", ℬ: "\\mathcal{B}", ℰ: "\\mathcal{E}", ℳ: "\\mathcal{M}",
};
