/// <reference lib="webworker" />
import { removeText } from "../../lib/pdftools/textRemove";
import createQpdf from "@neslinesli93/qpdf-wasm";
import { flatten } from "../../lib/pdftools/flatten";
import { addThings, redactPages, type Addition } from "../../lib/pdftools/draw";
import { crop, readDetails, writeDetails } from "../../lib/pdftools/details";
import {
  compressImages,
  findImages,
  imagesToPdf,
  type Encoder,
  type FoundImage,
} from "../../lib/pdftools/images";
import { addMarks } from "../../lib/pdftools/markup";
import { addOcrText } from "../../lib/pdftools/ocrText";
import * as pages from "../../lib/pdftools/pages";
import { addPageNumbers, addWatermark } from "../../lib/pdftools/stamp";
import { removeWatermarks } from "../../lib/pdftools/unwatermark";

/**
 * The PDF tools' heavy lifting, off the app's own thread so the window never stops responding.
 * Each message is one job; the answer carries the result, or why it failed in plain words.
 */

declare const self: DedicatedWorkerGlobalScope;

type QpdfModule = {
  FS: {
    writeFile: (p: string, d: Uint8Array) => void;
    readFile: (p: string) => Uint8Array;
    unlink: (p: string) => void;
  };
  callMain: (args: string[]) => number;
};

let qpdfReady: Promise<QpdfModule> | null = null;
let qpdfErrors: string[] = [];

/** qpdf: passwords, repair and the final squeeze. Loaded only the first time it's needed. */
async function qpdf(input: Uint8Array, args: string[]): Promise<Uint8Array> {
  qpdfReady ??= (createQpdf as unknown as (o: object) => Promise<QpdfModule>)({
    locateFile: () => "/qpdf/qpdf.wasm",
    noInitialRun: true,
    print: () => {},
    printErr: (line: string) => qpdfErrors.push(line),
  });
  const q = await qpdfReady;
  qpdfErrors = [];
  q.FS.writeFile("/in.pdf", input);
  const code = q.callMain(["/in.pdf", ...args, "/out.pdf"]);
  // 3 is "done, with warnings": a damaged file it put right is a success.
  if (code !== 0 && code !== 3) {
    const text = qpdfErrors.join(" ");
    try {
      q.FS.unlink("/in.pdf");
    } catch {
      /* already gone */
    }
    if (/invalid password/i.test(text)) throw new Error("PASSWORD");
    throw new Error(text || "qpdf could not read this file.");
  }
  const out = q.FS.readFile("/out.pdf");
  q.FS.unlink("/in.pdf");
  q.FS.unlink("/out.pdf");
  return out;
}

/** Pictures through a canvas: smaller JPEGs for Compress, PNGs for Extract images. */
const encode: Encoder = async (img, o) => {
  let bitmap: ImageBitmap;
  if (img.kind === "jpg") {
    bitmap = await createImageBitmap(new Blob([img.data as BlobPart], { type: "image/jpeg" }));
  } else {
    const px = new Uint8ClampedArray(img.width * img.height * 4);
    const channels = img.kind === "rgb" ? 3 : 1;
    if (img.data.length < img.width * img.height * channels) return null;
    for (let i = 0, j = 0; i < px.length; i += 4, j += channels) {
      px[i] = img.data[j] ?? 0;
      px[i + 1] = img.data[channels === 3 ? j + 1 : j] ?? 0;
      px[i + 2] = img.data[channels === 3 ? j + 2 : j] ?? 0;
      px[i + 3] = 255;
    }
    bitmap = await createImageBitmap(new ImageData(px, img.width, img.height));
  }
  const scale = Math.min(1, o.maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(bitmap.width * scale)),
    Math.max(1, Math.round(bitmap.height * scale)),
  );
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await canvas.convertToBlob(
    o.type === "png" ? { type: "image/png" } : { type: "image/jpeg", quality: o.quality },
  );
  return new Uint8Array(await blob.arrayBuffer());
};

type Progress = (done: number, total: number) => void;

const OPS = {
  arrange: pages.arrange,
  keepPages: pages.keepPages,
  removePages: pages.removePages,
  rotatePages: pages.rotatePages,
  reversePages: pages.reversePages,
  copyOut: pages.copyOut,
  merge: pages.merge,
  insertBlank: pages.insertBlank,
  async split(bytes: Uint8Array, groups: number[][], progress: Progress) {
    const out: Uint8Array[] = [];
    for (let i = 0; i < groups.length; i++) {
      progress(i, groups.length);
      out.push(await pages.copyOut(bytes, groups[i] ?? []));
    }
    return out;
  },
  addPageNumbers,
  addWatermark,
  removeWatermarks,
  flatten,
  crop,
  readDetails,
  writeDetails,
  addThings: (bytes: Uint8Array, things: Addition[], fonts?: Record<string, Uint8Array>) =>
    addThings(bytes, things, fonts),
  redactPages,
  removeText,
  addMarks,
  addOcrText,
  imagesToPdf,
  async compress(bytes: Uint8Array, level: "light" | "recommended" | "strong", progress: Progress) {
    const squeezed = await compressImages(bytes, level, encode, progress);
    // qpdf packs the rest tighter and drops what nothing uses any more.
    const packed = await qpdf(squeezed.bytes, [
      "--object-streams=generate",
      "--compress-streams=y",
      "--recompress-flate",
      "--compression-level=9",
    ]).catch(() => squeezed.bytes);
    const best = packed.length < bytes.length ? packed : bytes;
    return { bytes: best, images: squeezed.images, before: bytes.length, after: best.length };
  },
  async extractImages(bytes: Uint8Array, progress: Progress) {
    const doc = await pages.load(bytes);
    const found: FoundImage[] = (await findImages(doc)).filter(
      (i) => i.width >= 16 && i.height >= 16,
    );
    const files: { name: string; bytes: Uint8Array }[] = [];
    for (let i = 0; i < found.length; i++) {
      progress(i, found.length);
      const img = found[i];
      if (!img) continue;

      if (img.kind === "jpg") files.push({ name: `image ${i + 1}.jpg`, bytes: img.data });
      else {
        const png = await encode(img, { maxSide: 100000, quality: 1, type: "png" });
        if (png) files.push({ name: `image ${i + 1}.png`, bytes: png });
      }
    }
    return files;
  },
  /** Password, permissions: the file as it will be saved. */
  protect(
    bytes: Uint8Array,
    user: string,
    owner: string,
    allow: { print: boolean; copy: boolean; edit: boolean },
  ) {
    return qpdf(bytes, [
      "--encrypt",
      user,
      owner || user || crypto.randomUUID(),
      "256",
      `--print=${allow.print ? "full" : "none"}`,
      `--extract=${allow.copy ? "y" : "n"}`,
      `--modify=${allow.edit ? "all" : "none"}`,
      "--",
    ]);
  },
  unlock(bytes: Uint8Array, password: string) {
    return qpdf(bytes, [`--password=${password}`, "--decrypt"]);
  },
  repair(bytes: Uint8Array) {
    return qpdf(bytes, ["--object-streams=generate"]);
  },
  async isEncrypted(bytes: Uint8Array) {
    // The trailer is at the end; "/Encrypt" there means a password or restrictions.
    const tail = new TextDecoder("latin1").decode(bytes.subarray(Math.max(0, bytes.length - 4096)));
    if (/\/Encrypt\s/.test(tail)) return true;
    const head = new TextDecoder("latin1").decode(
      bytes.subarray(0, Math.min(bytes.length, 1 << 20)),
    );
    return /\/Encrypt\s+\d+\s+\d+\s+R/.test(head);
  },
};

export type WorkerOps = typeof OPS;

self.onmessage = async (e: MessageEvent<{ id: number; op: keyof WorkerOps; args: unknown[] }>) => {
  const { id, op, args } = e.data;
  const progress: Progress = (done, total) => self.postMessage({ id, progress: [done, total] });
  try {
    const run = OPS[op] as (...a: unknown[]) => unknown;
    const result = await run(...args, progress);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
