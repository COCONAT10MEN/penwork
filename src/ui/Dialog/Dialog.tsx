import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "../Icon";
import { COOKIE_PATH } from "../shapes";
import { surfaceClass, type SurfaceMaterial } from "../Surface/Surface";
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
  material?: SurfaceMaterial;
  /** Something went wrong: the icon takes the error colour. */
  danger?: boolean;
}

/**
 * M3 basic dialog on the native <dialog> element: the browser traps focus, makes the rest of
 * the page inert, handles Escape and returns focus to the opener.
 */
export function Dialog({
  open,
  onClose,
  headline,
  icon,
  children,
  actions,
  material = "tonal",
  danger,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Only a press that both starts and ends on the scrim closes it, so selecting text inside
  // and releasing outside doesn't.
  const pressedOnScrim = useRef(false);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx(
        styles.dialog,
        material === "tonal" && styles.tonal,
        surfaceClass({ material, strength: "thick", floating: true }),
      )}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the dialog element itself (not its content) is a click on the scrim.
      onPointerDown={(e) => {
        pressedOnScrim.current = e.target === ref.current;
      }}
      onClick={(e) => {
        if (pressedOnScrim.current && e.target === ref.current) onClose();
        pressedOnScrim.current = false;
      }}
    >
      <div className={styles.content}>
        {icon && (
          <span className={styles.iconShape} data-danger={danger || undefined}>
            <svg viewBox="0 0 100 100" width="64" height="64" aria-hidden="true">
              <path d={COOKIE_PATH} />
            </svg>
            <Icon name={icon} size={28} filled className={styles.icon} />
          </span>
        )}
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
