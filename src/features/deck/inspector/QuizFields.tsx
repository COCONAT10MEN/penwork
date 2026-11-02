import { Button, IconButton } from "../../../ui";
import { CommitField, Group, Hint, type Editing } from "./fields";
import styles from "./Inspector.module.css";

interface Question {
  /** The question. */
  q: string;
  /** The options. */
  o: string[];
  /** Which option is right. */
  a: number;
  /** The explanation. */
  e: string;
}

const MOST_OPTIONS = 4;
const FEWEST_OPTIONS = 2;

function read(quiz: Element): Question[] | null {
  try {
    const data: unknown = JSON.parse(quiz.querySelector("script")?.textContent ?? "");
    return Array.isArray(data) ? (data as Question[]) : null;
  } catch {
    return null;
  }
}

export function QuizFields({ edit }: { edit: Editing }) {
  const data = read(edit.element);
  if (!data) return <Hint>This quiz's data can't be read.</Hint>;
  const save = (next: Question[]) =>
    edit.change((el) => {
      const script = el.querySelector("script");
      // A closing tag inside would end the script early.
      if (script) script.textContent = JSON.stringify(next).replace(/<\//g, "<\\/");
    });
  const update = (at: number, change: Partial<Question>) =>
    save(data.map((q, i) => (i === at ? { ...q, ...change } : q)));
  return (
    <>
      {data.map((question, at) => (
        <Group key={at} title={`Question ${at + 1}`}>
          <CommitField label="Question" value={question.q} onCommit={(q) => update(at, { q })} />
          {question.o.map((option, k) => (
            <div key={k} className={styles.row}>
              <CommitField
                label={`Option ${"ABCD"[k]}`}
                value={option}
                onCommit={(value) =>
                  update(at, { o: question.o.map((o, i) => (i === k ? value : o)) })
                }
              />
              <span className={styles.rowTools}>
                <IconButton
                  icon="check_circle"
                  label={`Option ${"ABCD"[k]} is the right answer`}
                  selected={question.a === k}
                  tooltip={false}
                  onClick={() => update(at, { a: k })}
                />
                <IconButton
                  icon="close"
                  label={`Remove option ${"ABCD"[k]}`}
                  disabled={question.o.length <= FEWEST_OPTIONS}
                  tooltip={false}
                  onClick={() =>
                    update(at, {
                      o: question.o.filter((_, i) => i !== k),
                      a: question.a === k ? 0 : question.a > k ? question.a - 1 : question.a,
                    })
                  }
                />
              </span>
            </div>
          ))}
          <div className={styles.buttons}>
            <Button
              variant="tonal"
              size="small"
              icon="add"
              disabled={question.o.length >= MOST_OPTIONS}
              onClick={() => update(at, { o: [...question.o, "New option"] })}
            >
              Option
            </Button>
            <Button
              variant="text"
              size="small"
              disabled={data.length < 2}
              onClick={() => save(data.filter((_, i) => i !== at))}
            >
              Remove question
            </Button>
          </div>
          <CommitField label="Explanation" value={question.e} onCommit={(e) => update(at, { e })} />
        </Group>
      ))}
      <Button
        variant="tonal"
        size="small"
        icon="add"
        onClick={() =>
          save([...data, { q: "New question", o: ["Yes", "No"], a: 0, e: "Why that's right." }])
        }
      >
        Add question
      </Button>
    </>
  );
}
