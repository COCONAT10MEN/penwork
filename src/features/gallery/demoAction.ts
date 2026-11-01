/** What a demo button does in the Gallery: a line in the console, as the app has no pop-ups. */
export function snack(action: Record<string, unknown>): void {
  console.info("Gallery:", action);
}
