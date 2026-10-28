import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { IconButton } from "../IconButton/IconButton";
import styles from "./Snackbar.module.css";

export interface SnackbarOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds; default 5 s, or 10 s when there is an action. 0 = stay until closed. */
  duration?: number;
}

interface Shown extends SnackbarOptions {
  id: number;
}

const SnackbarContext = createContext<((options: SnackbarOptions) => void) | null>(null);

/** Show a snackbar from anywhere below <SnackbarProvider>. */
// eslint-disable-next-line react-refresh/only-export-components -- hook belongs with its provider
export function useSnackbar(): (options: SnackbarOptions) => void {
  const show = useContext(SnackbarContext);
  if (!show) throw new Error("useSnackbar needs a <SnackbarProvider> above it");
  return show;
}

/** Hosts one snackbar at a time at the bottom of the window; later ones queue. */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Shown[]>([]);
  const nextId = useRef(1);
  const spring = useSpring("spatialDefault");
  const reduce = useReduceMotion();
  const current = queue[0];

  const show = useCallback((options: SnackbarOptions) => {
    setQueue((q) => [...q, { ...options, id: nextId.current++ }]);
  }, []);
  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);

  useEffect(() => {
    if (!current) return;
    const ms = current.duration ?? (current.actionLabel ? 10_000 : 5_000);
    if (ms === 0) return;
    const t = window.setTimeout(dismiss, ms);
    return () => window.clearTimeout(t);
  }, [current, dismiss]);

  const value = useMemo(() => show, [show]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {/* The live region stays mounted so screen readers announce each new message. */}
      <div className={styles.region} role="status" aria-live="polite">
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={current.id}
              className={styles.snackbar}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0, transition: spring }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              <span className={styles.message}>{current.message}</span>
              {current.actionLabel && (
                <button
                  type="button"
                  className={`pw-state ${styles.action}`}
                  onClick={() => {
                    current.onAction?.();
                    dismiss();
                  }}
                >
                  {current.actionLabel}
                </button>
              )}
              <IconButton
                icon="close"
                label="Dismiss"
                className={styles.close}
                onClick={dismiss}
                tooltip={false}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SnackbarContext.Provider>
  );
}
