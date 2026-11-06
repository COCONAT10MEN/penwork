import { animate, motion, useMotionValue, useTransform } from "motion/react";
import type { Transition } from "motion/react";
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
/** The same spring with its bounce taken out (critically damped), as the speed setting has it. */
function settle(t: Transition): Transition {
  if (!("stiffness" in t) || !t.stiffness) return t;
  return { ...t, damping: 2 * Math.sqrt(t.stiffness * ((t.mass as number | undefined) ?? 1)) };
}

export function Tabs({ label, tabs, value, onChange }: TabsProps) {
  const row = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ x: number; width: number } | null>(null);
  const lead = useSpring("spatialFast");
  const trail = useSpring("spatialDefault");
  // The jewel's two edges, moved apart: the leading one goes first and the other catches up, so on
  // a long jump it stretches toward the tab and lands there, as Material's tab indicator does.
  const left = useMotionValue(0);
  const right = useMotionValue(0);
  const width = useTransform(() => right.get() - left.get());
  const placed = useRef(false);

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
    if (!place) return;
    const to = { l: place.x, r: place.x + place.width };
    if (!placed.current) {
      placed.current = true;
      left.set(to.l);
      right.set(to.r);
      return;
    }
    const goingRight = to.l > left.get();
    // No bounce at either edge: a bounce over a long jump would carry it past the end tab.
    const a = animate(left, to.l, settle(goingRight ? trail : lead));
    const b = animate(right, to.r, settle(goingRight ? lead : trail));
    return () => {
      a.stop();
      b.stop();
    };
  }, [place, left, right, lead, trail]);

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
      {place && <motion.span className={styles.jewel} style={{ x: left, width }} />}
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
