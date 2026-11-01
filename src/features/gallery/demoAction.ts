import { notify } from "../notices/notices";

/** What a demo button does in the Gallery. */
export function snack(action: { message: string } & Record<string, unknown>): void {
  notify(action.message);
}
