import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "../Icon";
import styles from "./Dialog.module.css";

export interface DialogProps {
  open: boolean;
  /** Called for Escape, a click on the scrim, or when the parent should close it. */
  onClose: () => void;
  headline: string;
  icon?: string;
  children: ReactNode;
  /** Buttons along the bottom, usually text buttons with the main action last. */
  actions?: ReactNode;
}

/**
 * M3 basic dialog on the native <dialog> element: the browser traps focus, makes the rest of
 * the page inert, handles Escape and returns focus to the opener.
 */
export function Dialog({ open, onClose, headline, icon, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the dialog element itself (not its content) is a click on the scrim.
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className={styles.content}>
        {icon && <Icon name={icon} className={styles.icon} />}
        <h2 id={titleId} className={icon ? styles.headlineCentered : styles.headline}>
          {headline}
        </h2>
        <div id={bodyId} className={styles.body}>
          {children}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </dialog>
  );
}
