import { useState } from "react";
import { Button } from "../../../ui";
import { Group } from "./fields";
import styles from "./Inspector.module.css";

/** For what's too big for a small edit. Nothing leaves the app without the user moving it. */
export function AskAi({
  onCopy,
  onPaste,
}: {
  onCopy: (scope: "slide" | "all", request: string) => void;
  onPaste: () => void;
}) {
  const [request, setRequest] = useState("");
  return (
    <div className={styles.askAi}>
      <Group title="Bigger change? Ask AI">
        <textarea
          className={styles.textarea}
          aria-label="What should change"
          placeholder="Make this two columns with a diagram"
          rows={2}
          value={request}
          spellCheck={false}
          onChange={(e) => setRequest(e.target.value)}
        />
        <div className={styles.buttons}>
          <Button variant="tonal" size="small" onClick={() => onCopy("slide", request)}>
            Copy slide
          </Button>
          <Button variant="tonal" size="small" onClick={() => onCopy("all", request)}>
            Copy all
          </Button>
          <Button variant="tonal" size="small" onClick={onPaste}>
            Paste reply
          </Button>
        </div>
      </Group>
    </div>
  );
}
