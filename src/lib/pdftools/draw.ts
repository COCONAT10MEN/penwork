import { degrees, PDFName, StandardFonts } from "pdf-lib";
import { isolate, hexColor, seen } from "./stamp";
import { load, save } from "./pages";

/**
 * Edit and Sign: things added on top of pages. Areas are in the page's own coordinates (what a drag
 * on screen converts to); text and pictures are turned with the page so they read upright on it.
 */

export interface Area {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Addition =
  | { kind: "text"; area: Area; text: string; size: number; color: string }
  | { kind: "image"; area: Area; bytes: Uint8Array; type: "png" | "jpg"; opacity?: number }
  | { kind: "rect" | "ellipse"; area: Area; stroke: string; fill: string | null; width: number }
  | { kind: "line"; area: Area; stroke: string; width: number }
  | { kind: "field"; area: Area; field: "text" | "check"; name: string };

/** Only letters the built-in PDF font has can be typed as text; anything else goes in as a picture. */
export function plainText(text: string): boolean {
  return /^[\x20-\x7e\xa0-\xff\n]*$/.test(text);
}

export async function addThings(bytes: Uint8Array, things: Addition[]): Promise<Uint8Array> {
  const doc = await load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const isolated = new Set<number>();
  let fieldCount = 0;
  for (const t of things) {
    const page = pages[t.area.page - 1];
    if (!page) continue;
    if (!isolated.has(t.area.page) && t.kind !== "field") {
      isolate(doc, page);
      isolated.add(t.area.page);
    }
    const { x, y, width, height } = t.area;
    const turn = seen(page).turn;
    if (t.kind === "text") {
      const lines = t.text.split("\n");
      const lineH = t.size * 1.2;
      // The first line's baseline, at the top of the box as the page is seen.
      lines.forEach((line, i) => {
        const down = t.size * 0.8 + i * lineH;
        const [px, py] =
          turn === 90
            ? [x + down, y]
            : turn === 180
              ? [x + width, y + down]
              : turn === 270
                ? [x + width - down, y + height]
                : [x, y + height - down];
        page.drawText(line, {
          x: px,
          y: py,
          size: t.size,
          font,
          color: hexColor(t.color),
          rotate: degrees(turn),
        });
      });
    } else if (t.kind === "image") {
      const image = t.type === "png" ? await doc.embedPng(t.bytes) : await doc.embedJpg(t.bytes);
      const sideways = turn === 90 || turn === 270;
      const [w, h] = sideways ? [height, width] : [width, height];
      const [px, py] =
        turn === 90
          ? [x + width, y]
          : turn === 180
            ? [x + width, y + height]
            : turn === 270
              ? [x, y + height]
              : [x, y];
      page.drawImage(image, {
        x: px,
        y: py,
        width: w,
        height: h,
        rotate: degrees(turn),
        opacity: t.opacity ?? 1,
      });
    } else if (t.kind === "rect") {
      page.drawRectangle({
        x,
        y,
        width,
        height,
        borderColor: hexColor(t.stroke),
        borderWidth: t.width,
        ...(t.fill ? { color: hexColor(t.fill) } : {}),
      });
    } else if (t.kind === "ellipse") {
      page.drawEllipse({
        x: x + width / 2,
        y: y + height / 2,
        xScale: width / 2,
        yScale: height / 2,
        borderColor: hexColor(t.stroke),
        borderWidth: t.width,
        ...(t.fill ? { color: hexColor(t.fill) } : {}),
      });
    } else if (t.kind === "line") {
      page.drawLine({
        start: { x, y: y + height },
        end: { x: x + width, y },
        thickness: t.width,
        color: hexColor(t.stroke),
      });
    } else if (t.kind === "field") {
      const form = doc.getForm();
      const name = t.name || `Field ${++fieldCount}`;
      let unique = name;
      for (let i = 2; form.getFields().some((f) => f.getName() === unique); i++)
        unique = `${name} ${i}`;
      if (t.field === "check") form.createCheckBox(unique).addToPage(page, { x, y, width, height });
      else form.createTextField(unique).addToPage(page, { x, y, width, height, font });
    }
  }
  if (things.some((t) => t.kind === "field")) doc.getForm().updateFieldAppearances(font);
  return save(doc);
}

/**
 * Redact: the page becomes a picture of itself with the areas blacked out, so the hidden text is
 * gone from the file, not just covered. Links and notes on the page go too.
 */
export async function redactPages(
  bytes: Uint8Array,
  pictures: { page: number; jpg: Uint8Array }[],
): Promise<Uint8Array> {
  const doc = await load(bytes);
  const pages = doc.getPages();
  for (const p of pictures) {
    const page = pages[p.page - 1];
    if (!page) continue;
    const image = await doc.embedJpg(p.jpg);
    const box = page.getCropBox();
    const turn = seen(page).turn;
    const empty = doc.context.register(doc.context.flateStream(new Uint8Array()));
    page.node.set(PDFName.of("Contents"), empty);
    page.node.set(PDFName.of("Resources"), doc.context.obj({}));
    page.node.delete(PDFName.of("Annots"));
    // The picture was taken of the page as seen, so it goes in turned back.
    const sideways = turn === 90 || turn === 270;
    const [w, h] = sideways ? [box.height, box.width] : [box.width, box.height];
    const [px, py] =
      turn === 90
        ? [box.x + box.width, box.y]
        : turn === 180
          ? [box.x + box.width, box.y + box.height]
          : turn === 270
            ? [box.x, box.y + box.height]
            : [box.x, box.y];
    page.drawImage(image, { x: px, y: py, width: w, height: h, rotate: degrees(turn) });
  }
  return save(doc);
}
