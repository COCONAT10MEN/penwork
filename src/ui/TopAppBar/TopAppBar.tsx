import type { ReactNode } from "react";
import styles from "./TopAppBar.module.css";

export interface TopAppBarProps {
  title: string;
  subtitle?: string;
  /** Usually a back or menu IconButton. */
  leading?: ReactNode;
  /** Buttons at the end. */
  actions?: ReactNode;
}

/** M3 small top app bar (64px) with an optional subtitle, as in the PDF viewer mockup. */
export function TopAppBar({ title, subtitle, leading, actions }: TopAppBarProps) {
  return (
    <header className={styles.bar}>
      {leading && <div className={styles.leading}>{leading}</div>}
      <div className={styles.titles}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
