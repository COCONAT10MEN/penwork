import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { Button, Dialog, Icon, Surface } from "../../ui";
import { answerQuestion, clearNotice, useNotices, type Question } from "./notices";
import { TextMenu } from "./TextMenu";
import styles from "./NoticeLayer.module.css";

const NOTICE_MS = 3000;

function NoticeHost() {
  const notice = useNotices((s) => s.notice);
  const spring = useSpring("spatialDefault");
  const fade = useSpring("effectsDefault");
  const reduce = useReduceMotion();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => clearNotice(notice.id), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    // Stays mounted, so screen readers announce each new message.
    <div className={styles.region} role="status" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {notice && (
          <motion.div
            key={notice.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.8, "--pw-mat": 0 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              "--pw-mat": 1,
              transition: { default: spring, opacity: fade, "--pw-mat": fade },
            }}
            exit={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, y: 12, scale: 0.9, "--pw-mat": 0, transition: fade }
            }
          >
            <Surface material="glass" strength="thick" floating className={styles.notice}>
              <span className={styles.noticeIcon}>
                <Icon name={notice.icon} size={20} filled />
              </span>
              {notice.message}
            </Surface>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuestionHost() {
  const current = useNotices((s) => s.questions[0] ?? null);
  // Kept while the dialog animates away, so it doesn't empty out as it goes.
  const [shown, setShown] = useState<Question | null>(current);
  if (current && current !== shown) setShown(current);
  const choices = shown?.choices ?? [];

  return (
    <Dialog
      open={current !== null}
      onClose={() => answerQuestion(current?.dismiss ?? "")}
      headline={shown?.title ?? ""}
      icon={shown?.icon}
      danger={shown?.danger}
      material="glass"
      actions={choices.map((choice, i) => {
        const main = i === choices.length - 1;
        return (
          <Button
            key={choice.value}
            size="compact"
            variant={main ? "filled" : "text"}
            data-autofocus={main || undefined}
            onClick={() => answerQuestion(choice.value)}
          >
            {choice.label}
          </Button>
        );
      })}
    >
      {shown?.text}
    </Dialog>
  );
}

/** Everything the app says to the user, in its own design. Mounted once, at the top of the app. */
export function NoticeLayer() {
  return (
    <>
      <NoticeHost />
      <QuestionHost />
      <TextMenu />
    </>
  );
}
