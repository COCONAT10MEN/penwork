import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { toLines, toParagraphs, type Word } from "../../lib/pdftools/textLayout";

/** Reading a PDF's pages through pdf.js, the same engine that shows them: words and pictures. */

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  fontName: string;
}

/** Each piece of text with its place on the page as seen, measured from the top-left. */
export async function pageWords(page: PDFPageProxy): Promise<Word[]> {
  const view = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const styles = content.styles as Record<string, { fontFamily?: string }>;
  const words: Word[] = [];
  for (const raw of content.items) {
    const item = raw as TextItem;
    if (!("str" in item) || !item.str) continue;
    const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = item.transform;
    const size = Math.hypot(c, d) || Math.hypot(a, b);
    const [x, y] = view.convertToViewportPoint(e, f);
    const family = `${item.fontName} ${styles[item.fontName]?.fontFamily ?? ""}`;
    words.push({
      text: item.str,
      x,
      y,
      width: item.width,
      size,
      bold: /bold|black|heavy|semibold/i.test(family),
    });
  }
  return words;
}

export async function pageText(doc: PDFDocumentProxy, n: number) {
  const page = await doc.getPage(n);
  const lines = toLines(await pageWords(page));
  return { page, lines, paragraphs: toParagraphs(lines) };
}

/** A page drawn at `scale` (1 is 72 per inch), on white, as JPEG or PNG bytes. */
export async function renderPage(
  doc: PDFDocumentProxy,
  n: number,
  scale: number,
  type: "jpg" | "png" = "jpg",
  quality = 0.9,
  paint?: (ctx: CanvasRenderingContext2D, view: ReturnType<PDFPageProxy["getViewport"]>) => void,
): Promise<{ bytes: Uint8Array; width: number; height: number; canvas: HTMLCanvasElement }> {
  const page = await doc.getPage(n);
  const view = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(view.width));
  canvas.height = Math.max(1, Math.floor(view.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas to draw on.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport: view }).promise;
  paint?.(ctx, view);
  const blob = await new Promise<Blob | null>((done) =>
    canvas.toBlob(done, type === "png" ? "image/png" : "image/jpeg", quality),
  );
  if (!blob) throw new Error("The page couldn't be turned into a picture.");
  page.cleanup();
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: canvas.width,
    height: canvas.height,
    canvas,
  };
}

/** Pictures given to a tool as PNG or JPEG, whatever they came as. */
export async function asPngOrJpg(
  bytes: Uint8Array,
  name: string,
): Promise<{ bytes: Uint8Array; type: "png" | "jpg" }> {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "png") return { bytes, type: "png" };
  if (ext === "jpg" || ext === "jpeg") return { bytes, type: "jpg" };
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: "png" };
}

/** Text in any script, drawn as a picture: for letters the PDF's built-in font doesn't have. */
export async function textPicture(
  text: string,
  o: { size: number; color: string; font?: string; bold?: boolean },
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const scale = 4;
  const font = `${o.bold ? "700 " : ""}${o.size * scale}px ${o.font ?? "'Roboto Flex', 'Segoe UI', Arial, sans-serif"}`;
  const lines = text.split("\n");
  // The app's own fonts (Caveat for a typed signature) are only used once loaded; before that a
  // canvas quietly draws in a Windows font instead.
  await document.fonts.load(font, text).catch(() => []);
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("No canvas to draw on.");
  probe.font = font;
  const width = Math.ceil(Math.max(...lines.map((l) => probe.measureText(l).width), 1)) + 8;
  const lineH = o.size * scale * 1.25;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.ceil(lineH * lines.length) + 8;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas to draw on.");
  ctx.font = font;
  ctx.fillStyle = o.color;
  ctx.textBaseline = "top";
  ctx.direction = "inherit";
  lines.forEach((l, i) => ctx.fillText(l, 4, 4 + i * lineH));
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
  if (!blob) throw new Error("The text couldn't be drawn.");
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: width / scale,
    height: canvas.height / scale,
  };
}
