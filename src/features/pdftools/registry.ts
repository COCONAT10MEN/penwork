import { CONVERT_TOOLS } from "./toolsConvert";
import { EDIT_TOOLS } from "./toolsEdit";
import { PAGE_TOOLS } from "./toolsPages";
import type { Tool } from "./types";

/** Every entry in the ⋮ menu. A new tool, or something that isn't a tool, is one more entry. */
export const ALL_TOOLS: Tool[] = [...PAGE_TOOLS, ...EDIT_TOOLS, ...CONVERT_TOOLS];
