import { plainText, type Addition } from "../../lib/pdftools/draw";
import { runTool } from "./client";
import { asPngOrJpg, renderPage, textPicture } from "./pdfRead";
import { ALL_PAGES, pagesOf } from "./toolsPages";
import type { PlacedArea, Tool, ToolHost } from "./types";

/** Edit and sign, Security. */

const pictureOf = async (v: unknown) => {
  const [file] = (v as { bytes: Uint8Array; name: string }[] | undefined) ?? [];
  if (!file) throw new Error("Pick a picture first.");
  const img = await asPngOrJpg(file.bytes, file.name);
  const bitmap = await createImageBitmap(new Blob([img.bytes as BlobPart]));
  const aspect = bitmap.width / bitmap.height;
  bitmap.close();
  return { ...img, aspect };
};

const dataUrl = (bytes: Uint8Array, type: string) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(s)}`;
};

async function addAll(host: ToolHost, things: Addition[], message: string) {
  if (!things.length) return;
  await host.replace(await runTool("addThings", [await host.current(), things]), message);
}

/** Text the built-in font can't show goes in as a picture of itself. */
export async function textThing(
  area: PlacedArea,
  text: string,
  size: number,
  color: string,
  font?: "sans" | "serif" | "mono",
): Promise<Addition> {
  if (plainText(text)) return { kind: "text", area, text, size, color, font };
  const pic = await textPicture(text, { size, color });
  const scale = Math.min(area.width / pic.width, area.height / pic.height, 1);
  return {
    kind: "image",
    area: {
      ...area,
      y: area.y + area.height - pic.height * scale,
      width: pic.width * scale,
      height: pic.height * scale,
    },
    bytes: pic.bytes,
    type: "png",
  };
}

export const EDIT_TOOLS: Tool[] = [
  {
    id: "editText",
    title: "Edit text",
    icon: "edit_note",
    group: "edit",
    blurb: "Click words on a page to change them",
    keywords: "change text fix typo replace words edit",
    instant: true,
    async run(host) {
      host.editText();
    },
  },
  {
    id: "addText",
    title: "Add text",
    icon: "title",
    group: "edit",
    blurb: "Type anywhere on a page",
    keywords: "write type text box edit",
    fields: [
      { key: "size", kind: "slider", label: "Size", min: 6, max: 72, step: 1 },
      { key: "color", kind: "color", label: "Colour" },
    ],
    defaults: { size: 14, color: "#1b1b1f" },
    action: "Place on the page",
    async run(host, v) {
      const size = Number(v.size);
      const color = String(v.color);
      const areas = await host.place({
        hint: "Drag a box where the text goes, then type. Enter adds it.",
        multiple: true,
        typing: { size, color },
        look: "box",
      });
      const typed = (areas ?? []).filter((a) => a.text?.trim());
      const things = await Promise.all(typed.map((a) => textThing(a, a.text ?? "", size, color)));
      await addAll(
        host,
        things,
        typed.length === 1 ? "Text added." : `${typed.length} pieces of text added.`,
      );
    },
  },
  {
    id: "addImage",
    title: "Add picture",
    icon: "add_photo_alternate",
    group: "edit",
    blurb: "A logo, photo or stamp on a page",
    keywords: "image logo photo stamp insert",
    fields: [{ key: "files", kind: "files", label: "Picture", accept: "image", multiple: false }],
    defaults: { files: [] },
    action: "Place on the page",
    async run(host, v) {
      const pic = await pictureOf(v.files);
      const areas = await host.place({
        hint: "Drag where the picture goes.",
        multiple: true,
        aspect: pic.aspect,
        look: "picture",
        picture: dataUrl(pic.bytes, pic.type === "png" ? "image/png" : "image/jpeg"),
      });
      await addAll(
        host,
        (areas ?? []).map((area) => ({ kind: "image", area, bytes: pic.bytes, type: pic.type })),
        "Picture added.",
      );
    },
  },
  {
    id: "sign",
    title: "Sign",
    icon: "signature",
    group: "edit",
    blurb: "Draw, type or pick your signature and place it",
    keywords: "signature sign initials",
    fields: [{ key: "signature", kind: "signature", label: "Your signature" }],
    defaults: { signature: null },
    action: "Place on the page",
    async run(host, v) {
      const sig = v.signature as { bytes: Uint8Array; aspect: number } | null;
      if (!sig) throw new Error("Draw, type or pick a signature first.");
      const areas = await host.place({
        hint: "Drag where the signature goes.",
        multiple: true,
        aspect: sig.aspect,
        look: "picture",
        picture: dataUrl(sig.bytes, "image/png"),
      });
      await addAll(
        host,
        (areas ?? []).map((area) => ({ kind: "image", area, bytes: sig.bytes, type: "png" })),
        "Signed.",
      );
    },
  },
  {
    id: "watermark",
    title: "Watermark",
    icon: "branding_watermark",
    group: "edit",
    blurb: "Text or a picture across the pages, like DRAFT",
    keywords: "stamp confidential draft overlay",
    fields: [
      {
        key: "kind",
        kind: "choice",
        label: "Watermark",
        options: [
          { value: "text", label: "Text" },
          { value: "image", label: "Picture" },
        ],
      },
      { key: "text", kind: "text", label: "Text" },
      { key: "files", kind: "files", label: "Picture", accept: "image", multiple: false },
      {
        key: "place",
        kind: "choice",
        label: "Where",
        options: [
          { value: "center", label: "Middle" },
          { value: "tr", label: "Top" },
          { value: "br", label: "Bottom" },
        ],
      },
      {
        key: "angle",
        kind: "choice",
        label: "Angle",
        options: [
          { value: "45", label: "Diagonal" },
          { value: "0", label: "Level" },
        ],
      },
      {
        key: "scale",
        kind: "slider",
        label: "Size",
        min: 0.1,
        max: 0.9,
        step: 0.05,
        format: (n) => `${Math.round(n * 100)}%`,
      },
      {
        key: "opacity",
        kind: "slider",
        label: "See-through",
        min: 0.05,
        max: 1,
        step: 0.05,
        format: (n) => `${Math.round(n * 100)}%`,
      },
      { key: "color", kind: "color", label: "Colour" },
      { key: "pages", kind: "pages" },
    ],
    defaults: {
      kind: "text",
      text: "DRAFT",
      files: [],
      place: "center",
      angle: "45",
      scale: 0.6,
      opacity: 0.25,
      color: "#d32f2f",
      pages: ALL_PAGES,
    },
    action: "Add watermark",
    async run(host, v) {
      let image: { bytes: Uint8Array; type: "png" | "jpg" } | undefined;
      let text: string | undefined = String(v.text ?? "").trim();
      if (v.kind === "image") {
        image = await pictureOf(v.files);
        text = undefined;
      } else if (!text) throw new Error("Type the watermark's text.");
      else if (!plainText(text)) {
        image = {
          bytes: (await textPicture(text, { size: 96, color: String(v.color), bold: true })).bytes,
          type: "png",
        };
        text = undefined;
      }
      const out = await runTool("addWatermark", [
        await host.current(),
        {
          pages: pagesOf(host, v.pages),
          text,
          image,
          scale: Number(v.scale),
          opacity: Number(v.opacity),
          angle: Number(v.angle),
          color: String(v.color),
          place: v.place as "center",
        },
      ]);
      await host.replace(out, "Watermark added.");
    },
  },
  {
    id: "unwatermark",
    title: "Remove watermark",
    icon: "format_color_reset",
    group: "edit",
    blurb: "Takes out watermarks the PDF marks as watermarks",
    keywords: "delete watermark clean stamp",
    instant: true,
    async run(host) {
      const r = await runTool("removeWatermarks", [await host.current()]);
      if (!r.count)
        return "No marked watermark was found. One drawn as part of the page can't be told apart from it.";
      await host.replace(
        r.bytes,
        `Removed ${r.count} ${r.count === 1 ? "watermark" : "watermark parts"}.`,
      );
    },
  },
  {
    id: "pageNumbers",
    title: "Page numbers",
    icon: "format_list_numbered",
    group: "edit",
    blurb: "Numbers on every page, where you want them",
    keywords: "numbering footer header paginate",
    fields: [
      {
        key: "corner",
        kind: "choice",
        label: "Where",
        options: [
          { value: "bl", label: "Left" },
          { value: "bc", label: "Middle" },
          { value: "br", label: "Right" },
        ],
      },
      { key: "top", kind: "switch", label: "At the top instead" },
      {
        key: "format",
        kind: "choice",
        label: "Looks like",
        options: [
          { value: "n", label: "1" },
          { value: "page-n", label: "Page 1" },
          { value: "n-of", label: "1 / 9" },
          { value: "page-n-of", label: "Page 1 of 9" },
        ],
      },
      { key: "start", kind: "slider", label: "First number", min: 0, max: 999, step: 1 },
      { key: "size", kind: "slider", label: "Size", min: 6, max: 24, step: 1 },
      { key: "pages", kind: "pages" },
    ],
    defaults: { corner: "bc", top: false, format: "n", start: 1, size: 11, pages: ALL_PAGES },
    action: "Add numbers",
    async run(host, v) {
      const corner = `${v.top ? "t" : "b"}${String(v.corner)[1]}` as "bc";
      const out = await runTool("addPageNumbers", [
        await host.current(),
        {
          pages: pagesOf(host, v.pages),
          corner,
          format: v.format as "n",
          start: Number(v.start),
          size: Number(v.size),
          margin: 28,
          color: "#1b1b1f",
        },
      ]);
      await host.replace(out, "Page numbers added.");
    },
  },
  {
    id: "crop",
    title: "Crop",
    icon: "crop",
    group: "edit",
    blurb: "Trim the margins, or keep just one area",
    keywords: "trim margins cut area",
    fields: [
      {
        key: "how",
        kind: "choice",
        label: "Crop",
        options: [
          { value: "margins", label: "By margins" },
          { value: "area", label: "To an area" },
        ],
      },
      {
        key: "margin",
        kind: "slider",
        label: "Margin to trim",
        min: 1,
        max: 60,
        step: 1,
        format: (n) => `${n} mm`,
      },
      { key: "pages", kind: "pages" },
    ],
    defaults: { how: "margins", margin: 10, pages: ALL_PAGES },
    action: "Crop",
    async run(host, v) {
      const pages = pagesOf(host, v.pages);
      if (v.how === "area") {
        const [area] =
          (await host.place({ hint: "Drag around what to keep.", multiple: false, look: "box" })) ??
          [];
        if (!area) return;
        await host.replace(
          await runTool("crop", [await host.current(), { pages, area }]),
          "Cropped.",
        );
        return;
      }
      const m = (Number(v.margin) * 72) / 25.4;
      await host.replace(
        await runTool("crop", [
          await host.current(),
          { pages, margins: { top: m, right: m, bottom: m, left: m } },
        ]),
        "Cropped.",
      );
    },
  },
  {
    id: "fields",
    title: "Form fields",
    icon: "list_alt",
    group: "edit",
    blurb: "Boxes others can type in or tick",
    keywords: "form fillable field checkbox create",
    fields: [
      {
        key: "field",
        kind: "choice",
        label: "Add",
        options: [
          { value: "text", label: "Text boxes" },
          { value: "check", label: "Tick boxes" },
        ],
      },
    ],
    defaults: { field: "text" },
    action: "Place on the page",
    async run(host, v) {
      const areas = await host.place({
        hint: "Drag each box.",
        multiple: true,
        look: "box",
        aspect: v.field === "check" ? 1 : undefined,
      });
      await addAll(
        host,
        (areas ?? []).map((area) => ({ kind: "field", area, field: v.field as "text", name: "" })),
        "Fields added. They can be filled in now.",
      );
    },
  },
  {
    id: "redact",
    title: "Redact",
    icon: "ink_eraser",
    group: "edit",
    blurb: "Black out private text so it's gone from the file",
    keywords: "hide black out censor private remove text",
    fields: [
      {
        key: "note",
        kind: "note",
        text: "Pages with redactions are saved as images, so the covered text is removed for good.",
      },
    ],
    action: "Mark what to hide",
    async run(host) {
      const areas = await host.place({
        hint: "Drag over everything to hide, then Redact.",
        multiple: true,
        look: "dark",
        done: "Redact",
      });
      if (!areas?.length) return;
      const byPage = new Map<number, PlacedArea[]>();
      for (const a of areas) byPage.set(a.page, [...(byPage.get(a.page) ?? []), a]);
      const pictures = [];
      for (const [page, marks] of byPage) {
        const pic = await renderPage(host.doc, page, 200 / 72, "jpg", 0.9, (ctx, view) => {
          ctx.fillStyle = "#000";
          for (const m of marks) {
            const [x0, y0] = view.convertToViewportPoint(m.x, m.y);
            const [x1, y1] = view.convertToViewportPoint(m.x + m.width, m.y + m.height);
            ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
          }
        });
        pictures.push({ page, jpg: pic.bytes });
      }
      await host.replace(
        await runTool("redactPages", [await host.current(), pictures]),
        `Redacted ${areas.length} ${areas.length === 1 ? "area" : "areas"}.`,
      );
    },
  },
  {
    id: "protect",
    title: "Protect with a password",
    icon: "lock",
    group: "security",
    blurb: "Needs the password to open; choose what's allowed",
    keywords: "password encrypt secure lock",
    fields: [
      { key: "password", kind: "text", label: "Password", password: true },
      { key: "again", kind: "text", label: "Password again", password: true },
      { key: "print", kind: "switch", label: "Allow printing" },
      { key: "copy", kind: "switch", label: "Allow copying text" },
      { key: "edit", kind: "switch", label: "Allow changes" },
    ],
    defaults: { password: "", again: "", print: true, copy: true, edit: true },
    action: "Add password",
    async run(host, v) {
      const password = String(v.password);
      if (password.length < 4) throw new Error("Use at least 4 characters.");
      if (password !== v.again) throw new Error("The two passwords aren't the same.");
      host.setLock({
        password,
        allow: { print: Boolean(v.print), copy: Boolean(v.copy), edit: Boolean(v.edit) },
      });
      return "The password goes on when you save.";
    },
  },
  {
    id: "unlock",
    title: "Remove password",
    icon: "lock_open",
    group: "security",
    blurb: "Save this PDF without its password",
    keywords: "unlock decrypt password remove",
    instant: true,
    when: (host) => host.lock !== null,
    async run(host) {
      host.setLock(null);
      return "The password comes off when you save.";
    },
  },
];
