import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

const WIDTH = 640;
const HEIGHT = 360;

function nextPaint(): Promise<void> {
  return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
}

/** Where the 16:9 slide sits inside its frame, which may be a different shape. */
export function slideRect(frame: { left: number; top: number; width: number; height: number }) {
  const unit = Math.min(frame.width / 16, frame.height / 9);
  const width = unit * 16;
  const height = unit * 9;
  return {
    x: frame.left + (frame.width - width) / 2,
    y: frame.top + (frame.height - height) / 2,
    width,
    height,
  };
}

/**
 * Saves what's on screen as this deck's thumbnail. Rust takes the picture, not the slide page, so
 * deck code can't choose what it shows. Failing only leaves the shaped placeholder in place.
 */
export async function captureThumb(frame: DOMRect, id: string): Promise<boolean> {
  const root = document.documentElement;
  try {
    // A note in front of the slide would end up in the picture.
    root.dataset.capturing = "";
    await nextPaint();
    const png = await invoke<ArrayBuffer>("capture_view");
    const image = await createImageBitmap(new Blob([png], { type: "image/png" }));
    const scale = image.width / window.innerWidth;
    const slide = slideRect(frame);
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas
      .getContext("2d")
      ?.drawImage(
        image,
        slide.x * scale,
        slide.y * scale,
        slide.width * scale,
        slide.height * scale,
        0,
        0,
        WIDTH,
        HEIGHT,
      );
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/webp", 0.82));
    if (!blob) return false;
    await invoke("write_thumb", new Uint8Array(await blob.arrayBuffer()), {
      headers: { "deck-id": id },
    });
    return true;
  } catch {
    return false;
  } finally {
    delete root.dataset.capturing;
  }
}

/**
 * Pictures already read and decoded, by file. Reading from disk on every mount meant each card's
 * picture landed at its own moment, so a page of them popped in piece by piece.
 */
const loaded = new Map<string, { version: string; url: string }>();
const reading = new Map<string, Promise<void>>();

function readThumb(id: string, version: string): Promise<void> {
  const key = `${id}:${version}`;
  const already = reading.get(key);
  if (already) return already;
  const read = invoke<ArrayBuffer>("read_thumb", { id })
    .then(async (bytes) => {
      if (bytes.byteLength === 0) return;
      const url = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
      const image = new Image();
      image.src = url;
      await image.decode().catch(() => {});
      const old = loaded.get(id);
      loaded.set(id, { version, url });
      if (old) URL.revokeObjectURL(old.url);
    })
    .catch(() => {})
    .finally(() => reading.delete(key));
  reading.set(key, read);
  return read;
}

/** Reads every picture up front, so the pages that show them can appear whole. */
export async function preloadThumbs(files: { id: string; thumb: string | null }[]): Promise<void> {
  if (!isTauri()) return;
  for (const { id, thumb } of files) {
    if (thumb && loaded.get(id)?.version !== thumb) await readThumb(id, thumb);
  }
}

/** The picture as a URL, or null while there is none. `version` reloads it when it changes. */
export function useThumb(id: string, version: string | null): string | null {
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!isTauri() || version === null || loaded.get(id)?.version === version) return;
    let cancelled = false;
    void readThumb(id, version).then(() => {
      if (!cancelled) redraw((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [id, version]);
  // An older picture stays up until the new one is ready, so a card never blinks empty.
  return version === null ? null : (loaded.get(id)?.url ?? null);
}
