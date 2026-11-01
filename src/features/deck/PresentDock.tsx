import { useState } from "react";
import { FloatingToolbar, IconButton, PenworkLogo } from "../../ui";
import { useSettings } from "../settings/settingsStore";
import styles from "./PresentDock.module.css";

/**
 * The first version of the dock: enough to use a show with the mouse alone. The tools, dragging,
 * snapping and all of its settings arrive with annotation in Stage 2.
 */
export function PresentDock({
  hidden,
  onGrid,
  onEnd,
}: {
  hidden: boolean;
  onGrid: () => void;
  onEnd: () => void;
}) {
  const logo = useSettings((s) => s.settings.logo);
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.dock} data-hidden={hidden || undefined}>
      <FloatingToolbar
        label="Presentation"
        open={open}
        onOpenChange={setOpen}
        logo={<PenworkLogo size={32} svg={logo?.svg} />}
        logoColor="var(--pw-logo-color)"
        logoBackground="var(--pw-logo-background)"
      >
        <IconButton icon="grid_view" label="All slides" onClick={onGrid} />
        <IconButton icon="close" label="End show" onClick={onEnd} />
      </FloatingToolbar>
    </div>
  );
}
