import { animate, motionValue, type MotionValue } from "motion/react";
import { springs } from "../theme/motion";

/**
 * How controls answer to a press, as Google builds it in Compose (ButtonGroup.kt, IconButton.kt).
 * CSS :active can't do any of this: a quick click would undo itself before it was seen, and a
 * press that changes its mind would restart from a standstill.
 *
 * - --pw-press rides the fast spatial spring, so size overshoots on the way back.
 * - --pw-morph rides the default effects spring. Corners never bounce.
 * - A released control waits until the press is 75% done, so even the shortest click shows.
 * - Springs keep their speed when turned around halfway.
 * - In a [data-press-group] the pressed control grows 15% and its neighbours give up the room.
 */
const HOLD_UNTIL = 0.75;
const GROW = 0.15;
// Google stops at the neighbour's padding; icon buttons have none, so a share of its width.
const MOST_A_NEIGHBOUR_GIVES = 0.18;

interface Press {
  el: HTMLElement;
  press: MotionValue<number>;
  morph: MotionValue<number>;
  group: Group | null;
  stopWaiting?: () => void;
}

interface Group {
  items: HTMLElement[];
  widths: number[];
}

const presses = new Map<HTMLElement, Press>();
const groups = new Map<Element, Group>();

function reduced(): boolean {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.hasAttribute("data-reduce-motion")
  );
}

function groupFor(el: HTMLElement): Group | null {
  const root = el.closest("[data-press-group]");
  if (!root) return null;
  let group = groups.get(root);
  if (!group) {
    const items = [...root.querySelectorAll<HTMLElement>("button")];
    group = { items, widths: items.map((item) => item.offsetWidth) };
    groups.set(root, group);
  }
  return group;
}

function layOut({ items, widths }: Group): void {
  const extra = new Map<number, number>();
  const add = (i: number, by: number) => extra.set(i, (extra.get(i) ?? 0) + by);
  items.forEach((item, i) => {
    const pressed = presses.get(item);
    if (!pressed) return;
    const neighbours = [i - 1, i + 1].filter((n) => n >= 0 && n < items.length);
    const grow = (widths[i] ?? 0) * GROW;
    for (const n of neighbours) {
      const most = (widths[n] ?? 0) * MOST_A_NEIGHBOUR_GIVES;
      const given = Math.min(grow / neighbours.length, most) * pressed.press.get();
      add(n, -given);
      add(i, given);
    }
  });
  items.forEach((item, i) => {
    item.style.flex = "none";
    item.style.minWidth = "0";
    item.style.width = `${(widths[i] ?? 0) + (extra.get(i) ?? 0)}px`;
  });
}

function settle(entry: Press): void {
  entry.el.style.removeProperty("--pw-press");
  entry.el.style.removeProperty("--pw-morph");
  presses.delete(entry.el);
  const root = entry.el.closest("[data-press-group]");
  const group = entry.group;
  if (!group || !root || group.items.some((item) => presses.has(item))) {
    if (group) layOut(group);
    return;
  }
  // Back to the stylesheet's sizes, which a resize may have changed since.
  for (const item of group.items) {
    item.style.removeProperty("flex");
    item.style.removeProperty("min-width");
    item.style.removeProperty("width");
  }
  groups.delete(root);
}

function entryFor(el: HTMLElement): Press {
  const existing = presses.get(el);
  if (existing) return existing;
  const entry: Press = {
    el,
    press: motionValue(0),
    morph: motionValue(0),
    group: groupFor(el),
  };
  presses.set(el, entry);
  entry.press.on("change", (v) => {
    el.style.setProperty("--pw-press", v.toFixed(3));
    if (entry.group) layOut(entry.group);
  });
  entry.morph.on("change", (v) => el.style.setProperty("--pw-morph", v.toFixed(3)));
  return entry;
}

function pressDown(el: HTMLElement, x: number, y: number): void {
  if (reduced()) return;
  const entry = entryFor(el);
  entry.stopWaiting?.();
  entry.stopWaiting = undefined;
  // Where the light starts from.
  el.style.setProperty("--pw-x", `${x}px`);
  el.style.setProperty("--pw-y", `${y}px`);
  void animate(entry.press, 1, springs.spatialFast);
  void animate(entry.morph, 1, springs.effectsDefault);
}

function letGo(el: HTMLElement): void {
  const entry = presses.get(el);
  if (!entry) return;
  const back = () => {
    void animate(entry.morph, 0, springs.effectsDefault);
    void animate(entry.press, 0, {
      ...springs.spatialFast,
      onComplete: () => settle(entry),
    });
  };
  if (entry.press.get() >= HOLD_UNTIL) return back();
  const stop = entry.press.on("change", (v) => {
    if (v < HOLD_UNTIL) return;
    stop();
    entry.stopWaiting = undefined;
    back();
  });
  entry.stopWaiting = stop;
}

function pressable(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>('.pw-press:not(:disabled, [aria-disabled="true"])');
}

/** The light on glass follows the pointer, and goes when it leaves. */
function followPointer(): void {
  let lit: HTMLElement | null = null;
  let frame = 0;
  let last: PointerEvent | null = null;
  const draw = () => {
    frame = 0;
    if (!last) return;
    const glass =
      last.target instanceof Element ? last.target.closest<HTMLElement>(".pw-glass") : null;
    if (glass !== lit) {
      lit?.style.removeProperty("--pw-light");
      lit = glass;
    }
    if (!glass) return;
    const box = glass.getBoundingClientRect();
    glass.style.setProperty("--pw-light", "1");
    glass.style.setProperty("--pw-light-x", `${last.clientX - box.left}px`);
    glass.style.setProperty("--pw-light-y", `${last.clientY - box.top}px`);
  };
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || reduced()) return;
    last = e;
    frame ||= requestAnimationFrame(draw);
  });
  document.documentElement.addEventListener("pointerleave", () => {
    lit?.style.removeProperty("--pw-light");
    lit = null;
  });
}

/** Called once at start-up. Listens on the document, so every .pw-press control gets it. */
export function installPress(): void {
  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const el = pressable(e.target);
    if (!el) return;
    const box = el.getBoundingClientRect();
    pressDown(el, e.clientX - box.left, e.clientY - box.top);
    const up = () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      letGo(el);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  });
  document.addEventListener("keydown", (e) => {
    if (e.repeat || (e.key !== "Enter" && e.key !== " ")) return;
    const el = pressable(e.target);
    if (!el) return;
    pressDown(el, el.offsetWidth / 2, el.offsetHeight / 2);
    const up = () => {
      document.removeEventListener("keyup", up);
      letGo(el);
    };
    document.addEventListener("keyup", up);
  });
  followPointer();
}
