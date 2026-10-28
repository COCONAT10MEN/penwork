/** Selection rules shared by ButtonGroup and SegmentedButton. */

export function isSelected(current: string | string[], value: string): boolean {
  return Array.isArray(current) ? current.includes(value) : current === value;
}

/**
 * Next selection after clicking `value`. Single-select keeps one value (clicking the
 * selected one keeps it). Multi-select toggles, but `required` keeps at least one selected.
 */
export function nextSelection(
  current: string | string[],
  value: string,
  required = false,
): string | string[] {
  if (!Array.isArray(current)) return value;
  if (current.includes(value)) {
    return required && current.length === 1 ? current : current.filter((v) => v !== value);
  }
  return [...current, value];
}
