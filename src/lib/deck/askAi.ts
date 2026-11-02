import { sanitizeSlides } from "./sanitize";
import { splitSlides } from "./slideOps";

/** The bridge to an AI chat. Nothing here sends anything: the user carries the text across. */
const RULES = `You are editing slides for Penwork, a presentation app. Write only the slides.

Rules:
- Reply with <section class="slide"> blocks in a \`\`\`html code block. No <html>, <head>, <body>, <script> or <link>.
- The stage is 1920x1080. Keep content 100px from the sides and 50px from the bottom. Titles stay on one line.
- Layout: .sec with .eb and h2, then .main. Columns: <div class="cols" style="--c:780px"><div></div><div></div></div>.
- Cards: <div class="card soft|key|note|tips|vio"> with <h3><span class="tri">▶</span>Title</h3>.
- Lists: <ul class="dots"> or <ul class="nums">. Emphasis: <b>, <b class="or"> orange, .tl teal, .mut grey.
- Formulas: <span class="tex">a = \\frac{F}{m}</span>, boxed in <span class="fbox"> (.or orange, .big large).
- Tables: <table class="tbl">. Diagrams: <div class="svgbox"> with inline <svg>, caption in .cap.
- Steps: add class st to what appears on click (l, r or z change how). data-st="=" joins the previous step.
- Keep each section's data-id, data-title and data-bg. Keep the .spill header exactly as it is.
- Pictures use src="assets/<name>". Nothing may load from the internet.
- Colour changes go in a separate \`\`\`css block, using the variables --teal, --or, --ink and --paper.`;

export interface PromptParts {
  request: string;
  title: string;
  slidesHtml: string;
  themeCss: string;
  /** "this slide" or "this presentation". */
  scope: string;
}

export function aiPrompt({ request, title, slidesHtml, themeCss, scope }: PromptParts): string {
  const ask = request.trim() || "Improve this, keeping its meaning.";
  return `${RULES}

Presentation: ${title}
What I want for ${scope}: ${ask}

Current slides:
\`\`\`html
${slidesHtml}
\`\`\`

Current colours and styles:
\`\`\`css
${themeCss}
\`\`\`
`;
}

export interface AiReply {
  slides: string[];
  css: string | null;
  /** What the sanitiser took out, to say so. */
  removed: string[];
}

// A theme runs in the slide page, but it still mustn't reach out of the file.
const UNSAFE_CSS = /@import|<|expression\(|url\(\s*["']?(?!assets\/|data:image\/|#)/i;

/** Finds slides in whatever the AI wrote, with or without code fences around them. */
export function readAiReply(text: string): AiReply {
  const css = text.match(/```css\s*([\s\S]*?)```/i)?.[1]?.trim() ?? null;
  const withoutCss = text.replace(/```css[\s\S]*?```/gi, "");
  const blocks = withoutCss.match(/<section[\s\S]*?<\/section>/gi) ?? [];
  const clean = sanitizeSlides(blocks.join("\n"));
  const unsafe = css !== null && UNSAFE_CSS.test(css);
  return {
    slides: splitSlides(clean.html).map((slide) => slide.html),
    css: unsafe ? null : css,
    removed: unsafe ? [...clean.removed, "unsafe colours or styles"] : clean.removed,
  };
}
