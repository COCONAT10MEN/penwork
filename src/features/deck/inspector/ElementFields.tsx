import { ButtonGroup, Slider, Switch } from "../../../ui";
import { CommitField, ColourField, Group, Hint, type Editing } from "./fields";
import { CardList, ChipList } from "./ListFields";
import { DiagramFields, ImageFields } from "./MediaFields";
import { QuizFields } from "./QuizFields";
import { TableFields } from "./TableFields";

const TITLE_FITS = 36;
const CARD_STYLES = ["soft", "key", "note", "tips", "vio"];

/** Text in a field. Text with bold or colour in it is edited on the slide, so that isn't lost. */
function plainText(el: Element): boolean {
  return el.children.length === 0;
}

function TextFields({ edit, label }: { edit: Editing; label: string }) {
  const { element } = edit;
  const text = element.textContent ?? "";
  const long = /^H[12]$/.test(element.tagName) && text.length > TITLE_FITS;
  return (
    <>
      {plainText(element) ? (
        <CommitField
          label={label}
          value={text}
          supporting={long ? "Long titles may not fit on one line." : undefined}
          onCommit={(value) =>
            edit.change((el) => {
              el.textContent = value;
            })
          }
        />
      ) : (
        <Hint>Double-click it on the slide to edit this text.</Hint>
      )}
      <ColourField edit={edit} />
    </>
  );
}

function CardFields({ edit }: { edit: Editing }) {
  const { element } = edit;
  const style = CARD_STYLES.find((c) => element.classList.contains(c)) ?? "plain";
  const heading = element.querySelector("h3");
  const words = heading?.lastChild?.textContent ?? "";
  return (
    <>
      <Group title="Card style">
        <ButtonGroup
          stretch
          label="Card style"
          value={style}
          options={[
            { value: "plain", label: "Plain" },
            { value: "soft", label: "Soft" },
            { value: "key", label: "Key" },
            { value: "note", label: "Note" },
            { value: "tips", label: "Tips" },
          ]}
          onChange={(next) =>
            edit.change((el) => {
              el.classList.remove(...CARD_STYLES);
              if (next !== "plain") el.classList.add(next);
            })
          }
        />
      </Group>
      {heading && (
        <CommitField
          label="Heading"
          value={words}
          onCommit={(value) =>
            edit.change((el) => {
              const last = el.querySelector("h3")?.lastChild;
              if (last) last.textContent = value;
            })
          }
        />
      )}
    </>
  );
}

function ListFields({ edit }: { edit: Editing }) {
  const numbered = edit.element.classList.contains("nums");
  return (
    <>
      <Group title="Kind of list">
        <ButtonGroup
          stretch
          label="Kind of list"
          value={numbered ? "nums" : "dots"}
          options={[
            { value: "dots", label: "Bullets" },
            { value: "nums", label: "Numbers" },
          ]}
          onChange={(next) =>
            edit.change((el) => {
              el.classList.remove("dots", "nums");
              el.classList.add(next);
            })
          }
        />
      </Group>
      <CardList edit={edit} />
    </>
  );
}

function FormulaFields({ edit }: { edit: Editing }) {
  const box = edit.element.classList.contains("fbox");
  const tex = box ? edit.element.querySelector(".tex") : edit.element;
  const style = !box
    ? null
    : edit.element.classList.contains("big")
      ? "big"
      : edit.element.classList.contains("or")
        ? "or"
        : "normal";
  return (
    <>
      {tex && (
        <CommitField
          label="Formula"
          value={tex.textContent ?? ""}
          supporting="Shows on the slide as you type."
          onType={(value) => edit.preview({ tex: value })}
          onCommit={(value) =>
            edit.change((el) => {
              const target = box ? el.querySelector(".tex") : el;
              if (target) target.textContent = value;
            })
          }
        />
      )}
      {style && (
        <Group title="Box style">
          <ButtonGroup
            stretch
            label="Box style"
            value={style}
            options={[
              { value: "normal", label: "Normal" },
              { value: "or", label: "Orange" },
              { value: "big", label: "Big" },
            ]}
            onChange={(next) =>
              edit.change((el) => {
                el.classList.remove("or", "big");
                if (next !== "normal") el.classList.add(next);
              })
            }
          />
        </Group>
      )}
    </>
  );
}

function ColumnsFields({ edit }: { edit: Editing }) {
  const el = edit.element as HTMLElement;
  const width = parseInt(el.style.getPropertyValue("--c"), 10) || 820;
  return (
    <Group title="Left column">
      <Slider
        label="Width"
        min={560}
        max={1100}
        step={10}
        value={width}
        format={(v) => `${v} px`}
        onChange={(v) => edit.preview({ prop: "--c", value: `${v}px` })}
        onCommit={(v) =>
          edit.change((target) => {
            (target as HTMLElement).style.setProperty("--c", `${v}px`);
          })
        }
      />
    </Group>
  );
}

/** Each piece of text inside something made of several, such as a worked example. */
function PartsFields({ edit }: { edit: Editing }) {
  const parts = Array.from(edit.element.querySelectorAll("*")).filter(
    (e) => e.children.length === 0 && (e.textContent ?? "").trim() !== "",
  );
  const all = Array.from(edit.element.querySelectorAll("*"));
  return (
    <>
      {parts.map((part) => {
        const at = all.indexOf(part);
        return (
          <CommitField
            key={at}
            label={part.closest(".ans") ? "Answer" : part.closest("h3,h4") ? "Heading" : "Text"}
            value={part.textContent ?? ""}
            onCommit={(value) =>
              edit.change((el) => {
                const target = el.querySelectorAll("*")[at];
                if (target) target.textContent = value;
              })
            }
          />
        );
      })}
      <Hint>Text with formulas or bold in it is edited on the slide.</Hint>
    </>
  );
}

/** The fields for whatever is picked. */
export function ElementFields({ edit }: { edit: Editing }) {
  const { element } = edit;
  // First: a quiz is a card as well.
  if (element.matches(".quiz")) return <QuizFields edit={edit} />;
  if (element.matches(".card")) return <CardFields edit={edit} />;
  if (element.matches("ul,ol")) return <ListFields edit={edit} />;
  if (element.matches(".fbox,.tex")) return <FormulaFields edit={edit} />;
  if (element.matches("table")) return <TableFields edit={edit} />;
  if (element.matches(".cols")) return <ColumnsFields edit={edit} />;
  if (element.matches(".svgbox")) return <DiagramFields edit={edit} />;
  if (element.matches("img")) return <ImageFields edit={edit} />;
  if (element.matches(".ex")) return <PartsFields edit={edit} />;
  if (element.matches(".toc")) return <ChipList edit={edit} />;
  if (element.matches("h1,h2")) return <TextFields edit={edit} label="Title" />;
  if (element.matches("li")) return <TextFields edit={edit} label="Bullet" />;
  if (element.matches("td,th")) return <TextFields edit={edit} label="Cell" />;
  return <TextFields edit={edit} label="Text" />;
}

/** Whether this item of a list is a step of its own. */
export function EachItemSteps({ edit }: { edit: Editing }) {
  const items = Array.from(edit.element.children);
  const on = items.length > 0 && items.every((li) => li.classList.contains("st"));
  return (
    <Switch
      label="Each item is its own step"
      checked={on}
      onCheckedChange={(next) =>
        edit.change((el) => {
          for (const li of Array.from(el.children)) li.classList.toggle("st", next);
        })
      }
    />
  );
}
