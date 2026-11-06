import { SHAPES } from "../../lib/pdftools/shapes";
import { runTool } from "./client";
import type { Tool } from "./types";

/**
 * Shapes, from a box to a star. The Shapes tab shows each shape as a tile; picking one opens this
 * tool with it chosen. Marks on text (underline, strike through, bold, italic) are on the bar that
 * appears over selected text, and highlighting is the toolbar's highlighter.
 */
export const SHAPE_TOOLS: Tool[] = [
  {
    id: "shapes",
    title: "Shapes",
    icon: "category",
    group: "shapes",
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
];
