import type { KeyboardEvent } from "react";

// Disabled items stay reachable (but inert), as in the WAI-ARIA menu pattern, so keyboard
// users can hear why they are disabled.
const ITEM = '[role="menuitem"]';
const ENABLED_ITEM = '[role="menuitem"]:not([aria-disabled="true"])';

/**
 * Arrow/Home/End navigation between menu items inside `container`. Returns true when the key
 * was handled.
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
  (
    container?.querySelector<HTMLElement>(ENABLED_ITEM) ??
    container?.querySelector<HTMLElement>(ITEM)
  )?.focus();
}

/**
 * Where a popup (menu, tooltip) is rendered. Inside an open modal <dialog> it must stay in the
 * dialog, because everything outside is inert and below it. Otherwise use the nearest
 * forced-theme panel (Gallery) so it keeps that panel's light/dark colors.
 */
export function portalTarget(anchor: Element | null): HTMLElement {
  return (
    (anchor?.closest("dialog[open], .pw-theme-light, .pw-theme-dark") as HTMLElement | null) ??
    document.body
  );
}
