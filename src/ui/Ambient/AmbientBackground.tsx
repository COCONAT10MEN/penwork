import styles from "./AmbientBackground.module.css";

/**
 * Soft color behind glass, so glass has something to glow over (DESIGN-GLASS §3). Radial
 * gradients, not blur filters, and still by default: moving blobs would make every glass panel
 * re-blur on every frame, even while the app is idle.
 */
export function AmbientBackground() {
  return (
    <div className={styles.ambient} aria-hidden="true">
      <span className={styles.a} />
      <span className={styles.b} />
      <span className={styles.c} />
    </div>
  );
}
