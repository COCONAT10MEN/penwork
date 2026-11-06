import { SHAPE_TOOLS } from "./toolsShapes";
import { CONVERT_TOOLS } from "./toolsConvert";
import { EDIT_TOOLS } from "./toolsEdit";
import { EXPORT_TOOLS } from "./toolsExport";
import { PAGE_TOOLS } from "./toolsPages";
import type { Tool } from "./types";

/** Every entry in the ⋮ menu. A new tool, or something that isn't a tool, is one more entry. */
export const ALL_TOOLS: Tool[] = [
  ...PAGE_TOOLS,
  ...EDIT_TOOLS,
  ...SHAPE_TOOLS,
  ...CONVERT_TOOLS,
  ...EXPORT_TOOLS,
];
