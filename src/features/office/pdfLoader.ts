import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";

/** pdf_viewer.mjs reads pdf.js from a global, so that has to be set before it is imported. */
export async function loadPdf() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  (globalThis as { pdfjsLib?: unknown }).pdfjsLib = pdfjs;
  const viewer = await import("pdfjs-dist/web/pdf_viewer.mjs");
  return { pdfjs, viewer };
}

/** Copied into the app by scripts/copy-pdfjs.mjs, so that nothing comes from the internet. */
export const PDF_ASSETS = {
  cMapUrl: "/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  wasmUrl: "/pdfjs/wasm/",
  iccUrl: "/pdfjs/iccs/",
  // A PDF is a stranger's file: nothing in it may run as code.
  isEvalSupported: false,
  enableScripting: false,
};
