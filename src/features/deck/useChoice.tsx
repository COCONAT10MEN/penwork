import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button, Dialog } from "../../ui";

export interface ChoiceOptions<T extends string> {
  headline: string;
  text: string;
  icon?: string;
  /** Left to right, the last being the main action. */
  actions: { value: T; label: string }[];
}

/** A question that code can wait on: await ask(...) gives the answer, or null if it was dismissed. */
export function useChoice(): {
  dialog: ReactNode;
  ask: <T extends string>(options: ChoiceOptions<T>) => Promise<T | null>;
} {
  const [question, setQuestion] = useState<ChoiceOptions<string> | null>(null);
  const answer = useRef<(value: string | null) => void>(() => {});

  const ask = useCallback(<T extends string>(options: ChoiceOptions<T>) => {
    setQuestion(options);
    return new Promise<T | null>((done) => {
      answer.current = (value) => done(value as T | null);
    });
  }, []);

  const finish = (value: string | null) => {
    setQuestion(null);
    answer.current(value);
  };

  const actions = question?.actions ?? [];
  const dialog = (
    <Dialog
      open={question !== null}
      onClose={() => finish(null)}
      headline={question?.headline ?? ""}
      icon={question?.icon}
      material="glass"
      actions={actions.map((action, i) => (
        <Button
          key={action.value}
          size="medium"
          variant={i === actions.length - 1 ? "filled" : "text"}
          onClick={() => finish(action.value)}
        >
          {action.label}
        </Button>
      ))}
    >
      {question?.text}
    </Dialog>
  );
  return { dialog, ask };
}
