import { isTauri } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";

/** Real Windows message boxes: a Windows app tells people things the way Windows does. */

export function showError(text: string, title = "Penwork"): void {
  if (isTauri()) void message(text, { title, kind: "error" });
}

export function showWarning(text: string, title = "Penwork"): void {
  if (isTauri()) void message(text, { title, kind: "warning" });
}

export type ThreeWay = "yes" | "no" | "cancel";

/** Three labelled buttons. Enter takes the first; Esc or the window's X is the same as "cancel". */
export async function askThreeWay(question: {
  title: string;
  text: string;
  yes: string;
  no: string;
  cancel: string;
  kind?: "info" | "warning";
}): Promise<ThreeWay> {
  if (!isTauri()) return "cancel";
  const { title, text, yes, no, cancel, kind = "info" } = question;
  const answer = await message(text, { title, kind, buttons: { yes, no, cancel } });
  if (answer === yes || answer === "Yes") return "yes";
  if (answer === no || answer === "No") return "no";
  return "cancel";
}

/** Two labelled buttons, for a go-ahead. Anything but the first means no. */
export async function askGoAhead(question: {
  title: string;
  text: string;
  ok: string;
  cancel: string;
}): Promise<boolean> {
  if (!isTauri()) return false;
  const { title, text, ok, cancel } = question;
  const answer = await message(text, { title, kind: "warning", buttons: { ok, cancel } });
  return answer === ok || answer === "Ok";
}
