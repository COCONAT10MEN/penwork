/**
 * Selecting from the margin. Pressed beside the words rather than on them, the browser picks a
 * start of its own in pdf.js's text layer (often the far end of the line, or nothing at all), so the
 * wrong words are selected. Here a press off the words starts at the nearest word instead, and the
 * drag runs from there, as in other PDF readers. A press on the words is left to the browser.
 */

interface Caret {
  node: Text;
  offset: number;
}

const textOf = (span: Element) =>
  span.firstChild?.nodeType === 3 ? (span.firstChild as Text) : null;

/** The place in the words nearest a point: on its line first, then the closest line. */
function caretNear(doc: Document, layer: Element, x: number, y: number): Caret | null {
  const hit = doc.caretRangeFromPoint?.(x, y);
  const node = hit?.startContainer;
  if (node && node.nodeType === 3 && layer.contains(node)) {
    const b = node.parentElement?.getBoundingClientRect();
    if (b && y >= b.top && y <= b.bottom && x >= b.left - 1 && x <= b.right + 1)
      return { node: node as Text, offset: hit.startOffset };
  }
  let best: { text: Text; box: DOMRect } | null = null;
  let score = Infinity;
  for (const span of layer.querySelectorAll("span")) {
    const text = textOf(span);
    if (!text?.data.trim()) continue;
    const box = span.getBoundingClientRect();
    if (box.width < 1) continue;
    const dy = y < box.top ? box.top - y : y > box.bottom ? y - box.bottom : 0;
    const dx = x < box.left ? box.left - x : x > box.right ? x - box.right : 0;
    // A line away counts for more than any distance along a line.
    const s = dy * 10000 + dx;
    if (s < score) {
      score = s;
      best = { text, box };
    }
  }
  if (!best) return null;
  const { text, box } = best;
  if (x <= box.left) return { node: text, offset: 0 };
  if (x >= box.right) return { node: text, offset: text.length };
  const inLine = doc.caretRangeFromPoint?.(x, (box.top + box.bottom) / 2);
  if (inLine?.startContainer === text) return { node: text, offset: inLine.startOffset };
  return { node: text, offset: Math.round(((x - box.left) / box.width) * text.length) };
}

/** The text layer of the page under a point, if any. */
function layerAt(doc: Document, x: number, y: number) {
  return doc.elementFromPoint(x, y)?.closest(".page")?.querySelector(".textLayer") ?? null;
}

/** Starts listening; gives back the function that stops. */
export function marginSelect(doc: Document, busy: () => boolean): () => void {
  const onDown = (e: MouseEvent) => {
    if (e.button !== 0 || e.detail > 1 || busy()) return;
    const target = e.target as Element | null;
    const layer = target?.closest(".textLayer");
    if (!layer || (target !== layer && !target?.classList.contains("endOfContent"))) return;
    const start = caretNear(doc, layer, e.clientX, e.clientY);
    if (!start) return;
    // Not the browser's own start; the press still reaches pdf.js and the selection bar.
    e.preventDefault();
    const sel = doc.getSelection();
    sel?.collapse(start.node, start.offset);
    const move = (m: MouseEvent) => {
      const under = layerAt(doc, m.clientX, m.clientY) ?? layer;
      const end = caretNear(doc, under, m.clientX, m.clientY);
      if (end) sel?.setBaseAndExtent(start.node, start.offset, end.node, end.offset);
    };
    const up = () => {
      doc.removeEventListener("mousemove", move, true);
      doc.removeEventListener("mouseup", up, true);
    };
    doc.addEventListener("mousemove", move, true);
    doc.addEventListener("mouseup", up, true);
  };
  doc.addEventListener("mousedown", onDown, true);
  return () => doc.removeEventListener("mousedown", onDown, true);
}
