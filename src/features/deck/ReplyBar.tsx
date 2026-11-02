import type { ReactNode } from "react";
import { Button, ButtonGroup, Surface } from "../../ui";
import styles from "./DeckView.module.css";
import type { useAskAi } from "./useAskAi";
import type { useSlideEditing } from "./useSlideEditing";

/** Under the slide while an AI's reply is being tried out. Nothing has changed yet. */
function ReplyBar({
  count,
  showing,
  onShow,
  onReplace,
  onInsert,
  onCancel,
}: {
  count: number;
  showing: "before" | "after";
  onShow: (showing: "before" | "after") => void;
  onReplace: () => void;
  onInsert: () => void;
  onCancel: () => void;
}) {
  return (
    <Surface material="glass" floating className={styles.reply} role="group" aria-label="AI reply">
      <ButtonGroup
        label="Compare"
        value={showing}
        options={[
          { value: "before", label: "Before" },
          { value: "after", label: "After" },
        ]}
        onChange={onShow}
      />
      <Button size="small" onClick={onReplace}>
        {count > 1 ? `Replace with ${count} slides` : "Replace this slide"}
      </Button>
      <Button variant="tonal" size="small" onClick={onInsert}>
        Insert after
      </Button>
      <Button variant="text" size="small" onClick={onCancel}>
        Cancel
      </Button>
    </Surface>
  );
}

/** The usual toolbar, or the choices for an AI's reply while one is being tried. */
export function UnderSlide({
  ai,
  slide,
  editing,
  children,
}: {
  ai: ReturnType<typeof useAskAi>;
  slide: number;
  editing: ReturnType<typeof useSlideEditing>;
  children: ReactNode;
}) {
  const { reply } = ai;
  if (!reply) return children;
  const use = (replace: boolean) => {
    editing.applyReply(slide, reply.slides, replace, reply.css);
    ai.done();
  };
  return (
    <ReplyBar
      count={reply.slides.length}
      showing={ai.showing}
      onShow={ai.show}
      onReplace={() => use(true)}
      onInsert={() => use(false)}
      onCancel={ai.cancel}
    />
  );
}
