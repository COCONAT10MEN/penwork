import type { Ref } from "react";
import type { RuntimeMessage } from "../../lib/deck/bridge";
import { Button, Surface } from "../../ui";
import { RuntimeFrame, type RuntimeFrameHandle } from "./RuntimeFrame";
import styles from "./DeckView.module.css";

/** The slide list on the left of the edit view, with its Add slide button. */
export function SlideListPanel({
  token,
  title,
  boxRef,
  frameRef,
  onMessage,
  ready,
  onAdd,
}: {
  token: string;
  title: string;
  boxRef: Ref<HTMLDivElement>;
  frameRef: Ref<RuntimeFrameHandle>;
  onMessage: (message: RuntimeMessage) => void;
  ready: boolean;
  onAdd: () => void;
}) {
  return (
    <Surface material="glass" className={styles.sorter} role="complementary" aria-label="Slides">
      <div ref={boxRef} className={styles.sorterList} data-ready={ready || undefined}>
        <RuntimeFrame
          ref={frameRef}
          token={token}
          title={title}
          view="sorter"
          className={styles.sorterFrame}
          onMessage={onMessage}
        />
      </div>
      <Button size="compact" variant="tonal" icon="add" className={styles.addSlide} onClick={onAdd}>
        Add slide
      </Button>
    </Surface>
  );
}
