import { getStroke } from "perfect-freehand";
import { useRef, useState } from "react";
import { Button, SegmentedButton, TextField } from "../../ui";
import { pickFiles } from "./files";
import { asPngOrJpg, textPicture } from "./pdfRead";
import styles from "./PdfTools.module.css";

export interface Signature {
  bytes: Uint8Array;
  aspect: number;
}

type Point = [number, number, number];

/** A drawn signature, smoothed like the pen; typed in handwriting; or a picture of one. */
export function SignaturePad({ onChange }: { onChange: (s: Signature | null) => void }) {
  const [how, setHow] = useState<"draw" | "type" | "picture">("draw");
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);

  const redraw = () => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#1b1b1f";
    for (const s of strokes.current) {
      const outline = getStroke(s, { size: 5, thinning: 0.6, smoothing: 0.5, streamline: 0.5 });
      const [start] = outline;
      if (!start) continue;
      ctx.beginPath();
      ctx.moveTo(start[0], start[1]);
      for (const [x, y] of outline) ctx.lineTo(x, y);
      ctx.fill();
    }
  };

  /** Just the ink, cut to its own edges. */
  const finishDrawing = async () => {
    const c = canvas.current;
    const all = strokes.current.flat();
    if (!c || !all.length) return onChange(null);
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const pad = 6;
    const x0 = Math.max(0, Math.min(...xs) - pad);
    const y0 = Math.max(0, Math.min(...ys) - pad);
    const w = Math.min(c.width, Math.max(...xs) + pad) - x0;
    const h = Math.min(c.height, Math.max(...ys) + pad) - y0;
    const out = new OffscreenCanvas(Math.max(1, w * 3), Math.max(1, h * 3));
    out.getContext("2d")?.drawImage(c, x0, y0, w, h, 0, 0, out.width, out.height);
    const blob = await out.convertToBlob({ type: "image/png" });
    onChange({ bytes: new Uint8Array(await blob.arrayBuffer()), aspect: w / h });
  };

  return (
    <div className={styles.signature}>
      <SegmentedButton
        label="How to sign"
        required
        options={[
          { value: "draw", label: "Draw" },
          { value: "type", label: "Type" },
          { value: "picture", label: "Picture" },
        ]}
        value={how}
        onChange={(v) => {
          setHow(v as typeof how);
          onChange(null);
        }}
      />
      {how === "draw" && (
        <>
          <canvas
            ref={canvas}
            className={styles.pad}
            width={300}
            height={120}
            aria-label="Draw your signature here"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const r = e.currentTarget.getBoundingClientRect();
              strokes.current.push([[e.clientX - r.left, e.clientY - r.top, e.pressure || 0.5]]);
              redraw();
            }}
            onPointerMove={(e) => {
              if (!e.buttons) return;
              const r = e.currentTarget.getBoundingClientRect();
              strokes.current[strokes.current.length - 1]?.push([
                e.clientX - r.left,
                e.clientY - r.top,
                e.pressure || 0.5,
              ]);
              redraw();
            }}
            onPointerUp={() => void finishDrawing()}
          />
          <Button
            variant="text"
            size="small"
            icon="ink_eraser"
            onClick={() => {
              strokes.current = [];
              redraw();
              onChange(null);
            }}
          >
            Clear
          </Button>
        </>
      )}
      {how === "type" && (
        <>
          <TextField
            label="Your name"
            value={typed}
            onChange={async (text) => {
              setTyped(text);
              if (!text.trim()) return onChange(null);
              const pic = await textPicture(text, {
                size: 40,
                color: "#1b1b1f",
                font: "'Caveat Variable', 'Caveat', cursive",
              });
              onChange({ bytes: pic.bytes, aspect: pic.width / pic.height });
            }}
          />
          {typed && <p className={styles.typedSignature}>{typed}</p>}
        </>
      )}
      {how === "picture" && (
        <>
          <Button
            variant="tonal"
            size="small"
            icon="image"
            onClick={async () => {
              const [file] = await pickFiles("image", false);
              if (!file) return;
              const img = await asPngOrJpg(file.bytes, file.name);
              const bitmap = await createImageBitmap(new Blob([img.bytes as BlobPart]));
              setPicked(file.name);
              // A PNG keeps its see-through background; a JPEG goes in as it is.
              onChange({
                bytes:
                  img.type === "png" ? img.bytes : (await asPngOrJpg(img.bytes, "x.webp")).bytes,
                aspect: bitmap.width / bitmap.height,
              });
              bitmap.close();
            }}
          >
            {picked ?? "Pick a picture"}
          </Button>
        </>
      )}
    </div>
  );
}
