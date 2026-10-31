// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { checkLogo } from "./logo";

const svg = (body: string, attrs = 'viewBox="0 0 100 100"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;

function refusal(name: string, text: string): string {
  const result = checkLogo(name, text);
  if (result.ok) throw new Error("expected a refusal");
  return result.message;
}

describe("checkLogo", () => {
  it("accepts a one-colour logo and swaps its colour for currentColor", () => {
    const result = checkLogo("mark.svg", svg('<circle cx="50" cy="50" r="40" fill="#E5352B"/>'));
    if (!result.ok) throw new Error(result.message);
    expect(result.color).toBe("#e5352b");
    expect(result.svg).toContain("currentColor");
    expect(result.svg.toLowerCase()).not.toContain("#e5352b");
  });

  it("treats the same colour written two ways as one colour", () => {
    const result = checkLogo(
      "mark.svg",
      svg('<path d="M0 0h10" fill="#ff0000"/><path d="M0 5h10" stroke="#F00"/>'),
    );
    expect(result.ok).toBe(true);
  });

  it("treats unpainted shapes as black", () => {
    const result = checkLogo("mark.svg", svg('<path d="M0 0h10v10z"/>'));
    if (!result.ok) throw new Error(result.message);
    expect(result.color).toBe("#000000");
    expect(result.svg).toContain("currentColor");
  });

  it("reads colours from style attributes and style blocks", () => {
    const styled = svg(
      '<path d="M0 0" style="fill:#123456"/><path d="M0 1" style="fill:#654321"/>',
    );
    expect(refusal("mark.svg", styled)).toContain("one colour");
    const block = svg('<style>.a{fill:#123456}</style><path class="a" d="M0 0"/>');
    const result = checkLogo("mark.svg", block);
    if (!result.ok) throw new Error(result.message);
    expect(result.svg).not.toContain("#123456");
  });

  it("refuses other file types with the reason", () => {
    expect(refusal("mark.png", "")).toContain(".svg");
    expect(refusal("mark.jpg", "")).toContain(".svg");
  });

  it("refuses a logo over 200 KB", () => {
    expect(refusal("mark.svg", svg("x".repeat(210 * 1024)))).toContain("200 KB");
  });

  it("refuses a file that isn't an SVG", () => {
    expect(refusal("mark.svg", "<html></html>")).toContain("valid SVG");
    expect(refusal("mark.svg", "not xml at all")).toContain("valid SVG");
  });

  it("refuses a logo that isn't square or has no viewBox", () => {
    expect(refusal("mark.svg", svg("", 'viewBox="0 0 100 50"'))).toContain("square");
    expect(refusal("mark.svg", svg("", 'width="100" height="100"'))).toContain("square");
  });

  it("refuses more than one colour, and gradients", () => {
    const two = svg('<path d="M0 0" fill="#111111"/><path d="M0 1" fill="#222222"/>');
    expect(refusal("mark.svg", two)).toContain("one colour");
    expect(refusal("mark.svg", svg("<linearGradient/>"))).toContain("one colour");
  });

  it("refuses scripts, images, animation, text and links", () => {
    expect(refusal("mark.svg", svg("<script>alert(1)</script>"))).toContain("scripts");
    expect(refusal("mark.svg", svg('<image href="a.png"/>'))).toContain("images");
    expect(refusal("mark.svg", svg('<animate attributeName="x"/>'))).toContain("animation");
    expect(refusal("mark.svg", svg("<text>Hi</text>"))).toContain("shapes");
    expect(refusal("mark.svg", svg('<a href="https://x.test"><path d="M0 0"/></a>'))).toContain(
      "links",
    );
  });

  it("refuses a painted background", () => {
    const filled = svg('<rect width="100" height="100" fill="#ffffff"/>');
    expect(refusal("mark.svg", filled)).toContain("transparent");
    const percent = svg('<rect width="100%" height="100%" fill="#ffffff"/>');
    expect(refusal("mark.svg", percent)).toContain("transparent");
  });

  it("removes event handlers and outside references", () => {
    const result = checkLogo(
      "mark.svg",
      svg('<path d="M0 0" onclick="boom()"/><use href="https://x.test/a.svg#b"/>'),
    );
    if (!result.ok) throw new Error(result.message);
    expect(result.svg).not.toContain("onclick");
    expect(result.svg).not.toContain("x.test");
  });
});
