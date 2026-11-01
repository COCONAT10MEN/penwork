import { cx } from "../cx";
import styles from "./AmbientBackground.module.css";

/**
 * Soft color behind glass, so glass has something to glow over (DESIGN-GLASS §3). Radial
 * gradients, not blur filters, and still by default: moving blobs would make every glass panel
 * re-blur on every frame, even while the app is idle.
 */
export function AmbientBackground({ layout = "home" }: { layout?: "home" | "edit" }) {
  return (
    <div className={cx(styles.ambient, styles[layout])} aria-hidden="true">
      <span className={styles.a} />
      <span className={styles.b} />
      <span className={styles.c} />
    </div>
  );
}
