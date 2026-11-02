import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
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
 * A glass capsule of tabs. One solid jewel lies under all of them and slides to the selected one,
 * so it passes behind the labels on its way. One Tab stop: the arrow keys, Home and End move
 * between them. Too many for the width scrolls.
 */
export function Tabs({ label, tabs, value, onChange }: TabsProps) {
  const row = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ x: number; width: number } | null>(null);
  const glide = useSpring("spatialDefault");

  useLayoutEffect(() => {
    const box = row.current;
    if (!box) return;
    const measure = () => {
      const tab = box.querySelector<HTMLElement>('[aria-selected="true"]');
      if (tab) setPlace({ x: tab.offsetLeft, width: tab.offsetWidth });
    };
    measure();
    // The first paint can be in a fallback font of another width.
    const watcher = new ResizeObserver(measure);
    watcher.observe(box);
    return () => watcher.disconnect();
  }, [value]);

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
      {place && (
        <motion.span className={styles.jewel} initial={false} animate={place} transition={glide} />
      )}
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
            {icon && <Icon name={icon} size={20} filled={selected} />}
            {name}
          </button>
        );
      })}
    </div>
  );
}
