import { Section } from "./ShowcaseActions";
import styles from "./Gallery.module.css";

const TYPE_ROLES = [
  "display-large",
  "display-medium",
  "display-small",
  "headline-large",
  "headline-medium",
  "headline-small",
  "title-large",
  "title-medium",
  "title-small",
  "body-large",
  "body-medium",
  "body-small",
  "label-large",
  "label-medium",
  "label-small",
];

// Background role, then the text role that goes on it.
const SWATCHES: [string, string][] = [
  ["primary", "on-primary"],
  ["primary-container", "on-primary-container"],
  ["secondary", "on-secondary"],
  ["secondary-container", "on-secondary-container"],
  ["tertiary", "on-tertiary"],
  ["tertiary-container", "on-tertiary-container"],
  ["error", "on-error"],
  ["error-container", "on-error-container"],
  ["surface-container-lowest", "on-surface"],
  ["surface-container-low", "on-surface"],
  ["surface-container", "on-surface"],
  ["surface-container-high", "on-surface"],
  ["surface-container-highest", "on-surface"],
  ["inverse-surface", "inverse-on-surface"],
];

export function ShowcaseColors() {
  return (
    <Section title="Color roles">
      <div className={styles.swatches}>
        {SWATCHES.map(([bg, fg]) => (
          <div
            key={bg}
            className={styles.swatch}
            style={{ background: `var(--md-sys-color-${bg})`, color: `var(--md-sys-color-${fg})` }}
          >
            {bg}
          </div>
        ))}
      </div>
    </Section>
  );
}

export function ShowcaseType() {
  return (
    <Section title="Typography (normal · emphasized)">
      {TYPE_ROLES.map((role) => (
        <div key={role} className={styles.row}>
          <span className={`pw-type-${role}`}>{role}</span>
          <span className={`pw-type-${role} pw-type--emphasized`}>Good evening</span>
        </div>
      ))}
      <span className={styles.handwriting}>Handwriting stays the star of the page</span>
    </Section>
  );
}
