import { create } from "zustand";

/** What the app has to say to the user. NoticeHost and QuestionHost put it on screen. */

export interface Notice {
  id: number;
  message: string;
  icon: string;
}

export interface Question {
  id: number;
  title: string;
  text: string;
  icon: string;
  danger: boolean;
  /** Left to right. The last one is the main action, and where Enter lands. */
  choices: { value: string; label: string }[];
  /** What Esc or a click on the scrim means. */
  dismiss: string;
  answer: (value: string) => void;
}

export const useNotices = create<{ notice: Notice | null; questions: Question[] }>(() => ({
  notice: null,
  questions: [],
}));

let nextId = 1;

/** A short message that goes away by itself. A new one replaces the last. */
export function notify(message: string, icon = "check_circle"): void {
  useNotices.setState({ notice: { id: nextId++, message, icon } });
}

export function clearNotice(id: number): void {
  useNotices.setState((s) => (s.notice?.id === id ? { notice: null } : s));
}

function ask(question: Omit<Question, "id" | "answer">): Promise<string> {
  return new Promise((answer) => {
    useNotices.setState((s) => ({
      questions: [...s.questions, { ...question, id: nextId++, answer }],
    }));
  });
}

/** Answers the question on screen, and brings up the next one if any is waiting. */
export function answerQuestion(value: string): void {
  const [current, ...rest] = useNotices.getState().questions;
  if (!current) return;
  useNotices.setState({ questions: rest });
  current.answer(value);
}

const OK = [{ value: "ok", label: "OK" }];

export function showError(text: string, title = "That didn't work"): void {
  void ask({ title, text, icon: "error", danger: true, choices: OK, dismiss: "ok" });
}

export function showWarning(text: string, title = "Good to know"): void {
  void ask({ title, text, icon: "info", danger: false, choices: OK, dismiss: "ok" });
}

export type ThreeWay = "yes" | "no" | "cancel";

/** Three labelled buttons. Enter takes "yes"; Esc or a click outside is the same as "cancel". */
export async function askThreeWay(question: {
  title: string;
  text: string;
  yes: string;
  no: string;
  cancel: string;
  icon?: string;
}): Promise<ThreeWay> {
  const { title, text, yes, no, cancel, icon = "help" } = question;
  const answer = await ask({
    title,
    text,
    icon,
    danger: false,
    choices: [
      { value: "cancel", label: cancel },
      { value: "no", label: no },
      { value: "yes", label: yes },
    ],
    dismiss: "cancel",
  });
  return answer as ThreeWay;
}

/** Two labelled buttons, for a go-ahead. Anything but the main one means no. */
export async function askGoAhead(question: {
  title: string;
  text: string;
  ok: string;
  cancel: string;
  icon?: string;
}): Promise<boolean> {
  const { title, text, ok, cancel, icon = "help" } = question;
  const answer = await ask({
    title,
    text,
    icon,
    danger: false,
    choices: [
      { value: "cancel", label: cancel },
      { value: "ok", label: ok },
    ],
    dismiss: "cancel",
  });
  return answer === "ok";
}
