import { useState, type RefObject } from "react";
import { aiPrompt, readAiReply, type AiReply } from "../../lib/deck/askAi";
import { joinSlides, type DeckSlide } from "../../lib/deck/slideOps";
import { notify } from "../notices/notices";
import type { DeckMeta } from "./deckStore";
import type { RuntimeFrameHandle } from "./RuntimeFrame";

/** Copying for an AI chat, and trying its reply on the slide before anything changes. */
export function useAskAi(options: {
  stage: RefObject<RuntimeFrameHandle | null>;
  slides: readonly DeckSlide[];
  slide: number;
  meta: DeckMeta;
  title: string;
}) {
  const { stage, slides, slide, meta, title } = options;
  const [reply, setReply] = useState<AiReply | null>(null);
  const [showing, setShowing] = useState<"before" | "after">("after");

  const showOnStage = (list: readonly string[]) =>
    stage.current?.post("slides", { html: list.join("\n"), slide });

  const withReply = (next: AiReply) =>
    slides.flatMap((s, i) => (i === slide ? next.slides : [s.html]));

  const copy = async (scope: "slide" | "all", request: string) => {
    const one = slides[slide];
    const text = aiPrompt({
      request,
      title,
      themeCss: meta.theme,
      slidesHtml: scope === "slide" ? (one?.html ?? "") : joinSlides(slides),
      scope: scope === "slide" ? "this slide" : "this presentation",
    });
    await navigator.clipboard.writeText(text);
    notify("Copied. Paste it into your AI chat.", "content_copy");
  };

  const paste = async () => {
    const text = await navigator.clipboard.readText().catch(() => "");
    const next = readAiReply(text);
    if (next.slides.length === 0) {
      notify("There are no slides in what you copied.", "info");
      return;
    }
    if (next.removed.length > 0) notify(`Removed: ${next.removed.join(", ")}`, "info");
    setReply(next);
    setShowing("after");
    showOnStage(withReply(next));
  };

  const show = (which: "before" | "after") => {
    if (!reply) return;
    setShowing(which);
    showOnStage(which === "after" ? withReply(reply) : slides.map((s) => s.html));
  };

  const done = () => setReply(null);

  /** Back to what's really there, when the reply wasn't used. */
  const cancel = () => {
    showOnStage(slides.map((s) => s.html));
    done();
  };

  return { reply, showing, copy, paste, show, cancel, done };
}
