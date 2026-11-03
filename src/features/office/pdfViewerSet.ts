import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";

/*
 * pdf.js is driven by setting properties on its viewer. React's rules forbid writing to a value a
 * component was given, so the writes go through these, where the viewer is just an argument.
 */

export function setScale(viewer: PDFViewer, scale: number): void {
  viewer.currentScale = scale;
}

export function setPage(viewer: PDFViewer, page: number): void {
  viewer.currentPageNumber = page;
}

export function setEditorMode(viewer: PDFViewer, mode: number): void {
  viewer.annotationEditorMode = { mode };
}
