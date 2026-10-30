import { createContext, useContext } from "react";
import type { SurfaceMaterial } from "../../ui";

/** The Gallery's Glass / Tonal switch, read by every section. */
export const GalleryMaterial = createContext<SurfaceMaterial>("tonal");

export function useGalleryMaterial(): SurfaceMaterial {
  return useContext(GalleryMaterial);
}
