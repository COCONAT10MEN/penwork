import { create } from "zustand";

/** Asking for a PDF's password, in our own dialog. */

interface Ask {
  name: string;
  wrong: boolean;
  answer: (password: string | null) => void;
}

export const usePrompt = create<{ ask: Ask | null }>(() => ({ ask: null }));

export function askPassword(name: string, wrong: boolean): Promise<string | null> {
  return new Promise((answer) => usePrompt.setState({ ask: { name, wrong, answer } }));
}
