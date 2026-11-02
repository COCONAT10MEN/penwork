import { useCallback, useState, type RefObject } from "react";
import type { RuntimeMessage, TextBar } from "../../lib/deck/bridge";
import type { Picked } from "./inspector/Inspector";
import type { RuntimeFrameHandle } from "./RuntimeFrame";

/** What's picked on the slide, and the formatting toolbar while text is being typed. */
export function useSlideText(
  stage: RefObject<RuntimeFrameHandle | null>,
  setText: (slide: number, n: number, tag: string, html: string) => void,
) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [bar, setBar] = useState<TextBar | null>(null);
  const [formula, setFormula] = useState<string | null>(null);

  /** True if the message was one of these. */
  const onMessage = (message: RuntimeMessage): boolean => {
    if (message.type === "picked") {
      setPicked(message.n >= 0 ? { n: message.n, tag: message.tag, crumbs: message.crumbs } : null);
    } else if (message.type === "text") {
      setText(message.slide, message.n, message.tag, message.html);
    } else if (message.type === "textbar") {
      setBar(message.bar);
      if (!message.bar) setFormula(null);
    } else if (message.type === "formula") setFormula(message.src);
    else return false;
    return true;
  };

  const onFormula = useCallback(
    (src: string) => {
      setFormula(src);
      stage.current?.post("formulaSrc", { src });
    },
    [stage],
  );

  const onFormulaDone = useCallback(() => {
    setFormula(null);
    stage.current?.post("formulaDone");
    stage.current?.focus();
  }, [stage]);

  return { picked, bar, formula, onMessage, onFormula, onFormulaDone };
}
