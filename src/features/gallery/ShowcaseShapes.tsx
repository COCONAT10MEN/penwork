import { useState } from "react";
import { ColorSwatches, Shape, type ShapeName } from "../../ui";
import styles from "./Gallery.module.css";

const SHAPES: ShapeName[] = ["Cookie9Sided", "Flower", "Sunny", "Clover4Leaf", "Burst", "Heart"];
const COLORS = ["#00687A", "#3F5BD4", "#7A4FBF", "#B4287A", "#C2410C", "#2E7D32"];

/** Click the shape to see it morph. */
export function ShapeMorphDemo() {
  const [at, setAt] = useState(0);
  const [color, setColor] = useState("#3F5BD4");
  const name = SHAPES[at % SHAPES.length] ?? "Circle";
  return (
    <>
      <button
        type="button"
        className={styles.shapeButton}
        aria-label={`Morph ${name}`}
        onClick={() => setAt(at + 1)}
      >
        <Shape name={name} size={72} />
      </button>
      <Shape name={name} size={72} solid />
      <ColorSwatches label="Colours" colors={COLORS} value={color} onChange={setColor} />
    </>
  );
}
