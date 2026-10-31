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

/** The cached picture as a URL, or null while there is none. `version` reloads it when it changes. */
export function useThumb(id: string, version: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isTauri() || version === null) return;
    let cancelled = false;
    let made: string | null = null;
    void invoke<ArrayBuffer>("read_thumb", { id }).then((bytes) => {
      if (cancelled || bytes.byteLength === 0) return;
      made = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
      setUrl(made);
    });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id, version]);
  return url;
}
