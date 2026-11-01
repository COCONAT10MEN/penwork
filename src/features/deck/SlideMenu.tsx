import { useEffect, useRef, useState } from "react";
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
  hidden,
  canPaste,
  count,
  onClose,
  on,
}: {
  target: SlideMenuTarget | null;
  hidden: boolean;
  canPaste: boolean;
  count: number;
  onClose: () => void;
  on: {
    duplicate: (slide: number) => void;
    copy: (slide: number) => void;
    paste: () => void;
    hide: (slide: number) => void;
    remove: (slide: number) => void;
  };
}) {
  const point = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  // The menu measures its anchor as it opens, so the anchor has to be in place first.
  useEffect(() => {
    if (!target || !point.current) return;
    point.current.style.left = `${target.x}px`;
    point.current.style.top = `${target.y}px`;
    setAnchor(point.current);
  }, [target]);

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
      onSelect: on.paste,
    },
    {
      label: hidden ? "Show in a show" : "Hide from a show",
      icon: hidden ? "visibility" : "visibility_off",
      onSelect: () => on.hide(slide),
    },
    {
      label: many ? `Delete ${count} slides` : "Delete",
      icon: "delete",
      trailing: "Del",
      onSelect: () => on.remove(slide),
    },
  ];

  return (
    <>
      <span ref={point} className={styles.menuPoint} aria-hidden="true" />
      <Menu
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
