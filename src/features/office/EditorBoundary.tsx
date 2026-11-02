import { Component, type ReactNode } from "react";
import { Icon } from "../../ui";
import styles from "./OfficeView.module.css";

/** The editors are other people's code, and a file they trip on must not blank the whole app. */
export class EditorBoundary extends Component<
  { name: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className={styles.loading} role="alert">
        <p className={styles.failed}>
          <Icon name="error" size={32} />
          {`"${this.props.name}" couldn't be shown. The file itself hasn't changed.`}
        </p>
      </div>
    );
  }
}
