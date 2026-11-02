import { motion } from "motion/react";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { useSpring } from "../../theme/motion";
import { cx } from "../cx";
import { Icon } from "../Icon";
import styles from "./Tabs.module.css";

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
}

export interface TabsProps {
  /** Name of the whole row for screen readers. */
  label: string;
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
}

/**
 * A glass capsule of tabs. The solid jewel behind the selected one travels to the next on a spring.
 * One Tab stop: the arrow keys, Home and End move between them. Too many for the width scrolls.
 */
export function Tabs({ label, tabs, value, onChange }: TabsProps) {
  const jewel = useId();
  const row = useRef<HTMLDivElement>(null);
  const glide = useSpring("spatialFast");

  useEffect(() => {
    row.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  const go = (id: string | undefined) => {
    if (!id) return;
    onChange(id);
    row.current?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(id)}"]`)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const at = tabs.findIndex((tab) => tab.id === value);
    const last = tabs.length - 1;
    const to = { ArrowRight: at === last ? 0 : at + 1, ArrowLeft: at === 0 ? last : at - 1 };
    const target = { ...to, Home: 0, End: last }[e.key];
    if (target === undefined) return;
    e.preventDefault();
    go(tabs[target]?.id);
  };

  return (
    <div ref={row} role="tablist" aria-label={label} className={styles.tabs} onKeyDown={onKeyDown}>
      {tabs.map(({ id, label: name, icon }) => {
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            data-tab={id}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={cx("pw-state", styles.tab)}
            onClick={() => onChange(id)}
          >
            {selected && (
              <motion.span layoutId={jewel} className={styles.jewel} transition={glide} />
            )}
            {icon && <Icon name={icon} size={20} filled={selected} className={styles.label} />}
            <span className={styles.label}>{name}</span>
          </button>
        );
      })}
    </div>
  );
}
