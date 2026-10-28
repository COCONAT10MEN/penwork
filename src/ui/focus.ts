import type { KeyboardEvent } from "react";

const ITEM = '[role="menuitem"]:not([aria-disabled="true"])';

/**
 * Arrow/Home/End navigation between menu items inside `container`. Returns true when the key
 * was handled. Disabled items are skipped by the arrows (they stay readable by screen readers).
 */
export function handleMenuKeys(event: KeyboardEvent, container: HTMLElement | null): boolean {
  if (!container) return false;
  const items = Array.from(container.querySelectorAll<HTMLElement>(ITEM));
  if (items.length === 0) return false;
  const index = items.indexOf(document.activeElement as HTMLElement);
  let next: HTMLElement | undefined;
  switch (event.key) {
    case "ArrowDown":
      next = items[(index + 1) % items.length];
      break;
    case "ArrowUp":
      next = items[(index - 1 + items.length) % items.length];
      break;
    case "Home":
      next = items[0];
      break;
    case "End":
      next = items[items.length - 1];
      break;
    default:
      return false;
  }
  event.preventDefault();
  next?.focus();
  return true;
}

export function focusFirstItem(container: HTMLElement | null): void {
  container?.querySelector<HTMLElement>(ITEM)?.focus();
}

/**
 * Popups render in a portal; put them inside the nearest forced-theme panel (Gallery) so they
 * keep that panel's light/dark colors.
 */
export function portalTarget(anchor: Element | null): HTMLElement {
  return (
    (anchor?.closest(".pw-theme-light, .pw-theme-dark") as HTMLElement | null) ?? document.body
  );
}
