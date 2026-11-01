import { useEffect, useState } from "react";
import { Menu, type MenuEntry } from "../../ui";
import styles from "./DeckView.module.css";

export interface SlideMenuTarget {
  slide: number;
  x: number;
  y: number;
}

/** The right-click menu of the slide list. The list is inside its own page, so this sits on top. */
export function SlideMenu({
  target,
  hides,
  canPaste,
  canHide,
  canRemove,
  count,
  onClose,
  onAway,
  on,
}: {
  target: SlideMenuTarget | null;
  /** What Hide would do to these slides: hide them, or show them again. */
  hides: boolean;
  canPaste: boolean;
  canHide: boolean;
  canRemove: boolean;
  count: number;
  onClose: () => void;
  /** The user went elsewhere, so unlike onClose this leaves focus alone. */
  onAway: () => void;
  on: {
    duplicate: (slide: number) => void;
    copy: (slide: number) => void;
    paste: (slide: number) => void;
    hide: (slide: number) => void;
    remove: (slide: number) => void;
    nudge: (direction: -1 | 1, slide: number) => void;
  };
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  // A click inside a slide page never reaches this document, but it does take focus away.
  useEffect(() => {
    if (!target) return;
    window.addEventListener("blur", onAway);
    return () => window.removeEventListener("blur", onAway);
  }, [target, onAway]);

  const many = count > 1;
  const slide = target?.slide ?? 0;
  const items: MenuEntry[] = [
    {
      label: many ? `Duplicate ${count} slides` : "Duplicate",
      icon: "content_copy",
      trailing: "Ctrl+D",
      onSelect: () => on.duplicate(slide),
    },
    {
      label: many ? `Copy ${count} slides` : "Copy",
      icon: "file_copy",
      trailing: "Ctrl+C",
      onSelect: () => on.copy(slide),
    },
    {
      label: "Paste after",
      icon: "content_paste",
      trailing: "Ctrl+V",
      disabled: !canPaste,
      onSelect: () => on.paste(slide),
    },
    {
      label: "Move up",
      icon: "arrow_upward",
      trailing: "Alt+↑",
      onSelect: () => on.nudge(-1, slide),
    },
    {
      label: "Move down",
      icon: "arrow_downward",
      trailing: "Alt+↓",
      onSelect: () => on.nudge(1, slide),
    },
    {
      label: `${hides ? "Hide" : "Show"} ${many ? `${count} slides` : "slide"}`,
      icon: hides ? "visibility_off" : "visibility",
      disabled: !canHide,
      onSelect: () => on.hide(slide),
    },
    {
      label: many ? `Delete ${count} slides` : "Delete",
      icon: "delete",
      trailing: "Del",
      disabled: !canRemove,
      onSelect: () => on.remove(slide),
    },
  ];

  return (
    <>
      {/* Placed here, not in an effect: the menu measures this as it opens. */}
      <span
        ref={setAnchor}
        className={styles.menuPoint}
        style={target ? { left: target.x, top: target.y } : undefined}
        aria-hidden="true"
      />
      <Menu
        key={target ? `${target.x},${target.y}` : "closed"}
        open={target !== null && anchor !== null}
        anchor={anchor}
        label="Slide"
        material="glass"
        items={items}
        onClose={onClose}
      />
    </>
  );
}
