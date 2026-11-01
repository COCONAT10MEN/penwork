import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, type MenuEntry } from "../../ui";
import styles from "./NoticeLayer.module.css";

type Field = HTMLInputElement | HTMLTextAreaElement;

interface Target {
  field: Field;
  x: number;
  y: number;
}

const TEXT_INPUTS = "input:not([type=range],[type=checkbox],[type=radio]),textarea";

async function paste(field: Field): Promise<void> {
  const text = await navigator.clipboard.readText().catch(() => "");
  field.focus();
  if (text) document.execCommand("insertText", false, text);
}

/** Right-click anywhere does nothing, except on a text box: that gets Cut, Copy and Paste. */
export function TextMenu() {
  const [target, setTarget] = useState<Target | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const onMenu = (e: MouseEvent) => {
      e.preventDefault();
      const field = e.target instanceof Element ? e.target.closest<Field>(TEXT_INPUTS) : null;
      if (!field) return;
      field.focus();
      setTarget({ field, x: e.clientX, y: e.clientY });
    };
    document.addEventListener("contextmenu", onMenu);
    return () => document.removeEventListener("contextmenu", onMenu);
  }, []);

  if (!target) return null;
  const { field } = target;
  const selected = (field.selectionStart ?? 0) !== (field.selectionEnd ?? 0);
  const run = (action: () => void) => () => {
    field.focus();
    action();
  };
  const items: MenuEntry[] = [
    {
      label: "Cut",
      icon: "content_cut",
      trailing: "Ctrl+X",
      disabled: !selected || field.readOnly,
      onSelect: run(() => document.execCommand("cut")),
    },
    {
      label: "Copy",
      icon: "content_copy",
      trailing: "Ctrl+C",
      disabled: !selected,
      onSelect: run(() => document.execCommand("copy")),
    },
    {
      label: "Paste",
      icon: "content_paste",
      trailing: "Ctrl+V",
      disabled: field.readOnly,
      onSelect: () => void paste(field),
    },
    "divider",
    {
      label: "Select all",
      icon: "select_all",
      trailing: "Ctrl+A",
      disabled: field.value === "",
      onSelect: run(() => field.select()),
    },
  ];

  return (
    <>
      {/* A modal dialog makes everything outside it inert, so the menu has to start inside it. */}
      {createPortal(
        <span
          ref={setAnchor}
          className={styles.point}
          style={{ left: target.x, top: target.y }}
          aria-hidden="true"
        />,
        field.closest("dialog") ?? document.body,
      )}
      <Menu
        key={`${target.x},${target.y}`}
        open={anchor !== null}
        anchor={anchor}
        label="Text"
        material="glass"
        items={items}
        onClose={() => setTarget(null)}
      />
    </>
  );
}
