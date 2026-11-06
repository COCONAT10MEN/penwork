import { SHAPES } from "../../lib/pdftools/shapes";
import { runTool } from "./client";
import type { Tool } from "./types";

/**
 * Annotate: shapes, and marks on selected text. The freehand pens and the area highlighter are
 * the toolbar's, in the bar; the highlighter's own settings switch it to areas.
 */

function markTool(
  id: "highlight" | "underline" | "strike",
  title: string,
  icon: string,
  blurb: string,
  keywords: string,
): Tool {
  return {
    id: `mark-${id}`,
    title,
    icon,
    group: "annotate",
    blurb,
    keywords,
    instant: true,
    async run(host) {
      host.markText(id);
    },
  };
}

export const ANNOTATE_TOOLS: Tool[] = [
  {
    id: "shapes",
    title: "Shapes",
    icon: "category",
    group: "annotate",
    blurb: "Boxes, circles, arrows, stars and more",
    keywords:
      "rectangle square circle oval ellipse triangle arrow line star heart tick cross bubble diamond shape draw",
    fields: [
      { key: "shape", kind: "shape", label: "Shape" },
      { key: "color", kind: "color", label: "Colour" },
      { key: "width", kind: "slider", label: "Line width", min: 0.5, max: 12, step: 0.5 },
      { key: "fill", kind: "switch", label: "Filled in" },
    ],
    defaults: { shape: "rect", color: "#d32f2f", width: 2, fill: false },
    action: "Place on the page",
    async run(host, v) {
      const shape = String(v.shape);
      const label = SHAPES.find((s) => s.id === shape)?.label ?? "Shape";
      const areas = await host.place({
        hint: `Drag to draw each ${label.toLowerCase()}.`,
        multiple: true,
        look: "shape",
        shape,
      });
      if (!areas?.length) return;
      const stroke = String(v.color);
      const out = await runTool("addThings", [
        await host.current(),
        areas.map((area) => ({
          kind: "shape" as const,
          area,
          shape,
          stroke,
          fill: v.fill ? stroke : null,
          width: Number(v.width),
          flipX: area.flipX,
          flipY: area.flipY,
        })),
      ]);
      await host.replace(
        out,
        areas.length === 1 ? `${label} added.` : `${areas.length} shapes added.`,
      );
    },
  },
  markTool(
    "highlight",
    "Highlight text",
    "format_ink_highlighter",
    "Select text, and it's highlighted",
    "highlight marker yellow text select",
  ),
  markTool(
    "underline",
    "Underline",
    "format_underlined",
    "Select text, and it's underlined",
    "underline text select",
  ),
  markTool(
    "strike",
    "Strikethrough",
    "format_strikethrough",
    "Select text, and it's struck through",
    "strikethrough strike out cross text select",
  ),
];
