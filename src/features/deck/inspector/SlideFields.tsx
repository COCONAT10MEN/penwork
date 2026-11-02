import { ButtonGroup, Switch } from "../../../ui";
import { CommitField, Group, Hint, type Editing } from "./fields";

// The template's five background arrangements (its AI-GUIDE §3), and the one its covers use.
const BACKGROUNDS = [
  { value: "900,-420,1.2;1500,500,.9;-120,820,1.2;1650,-120,.7", label: "1" },
  { value: "-300,-200,1.1;1180,640,1.1;700,880,.8;1750,120,1", label: "2" },
  { value: "1480,160,1;-180,260,.8;1000,-480,1;500,780,1.2", label: "3" },
  { value: "200,700,1;1400,-200,1.1;1700,820,.8;-300,-100,1", label: "4" },
  { value: "1100,560,1.3;-100,-120,1;1600,-250,.9;800,-300,.8", label: "5" },
];

function TextOf({ edit, find, label }: { edit: Editing; find: string; label: string }) {
  const element = edit.element.querySelector(find);
  if (!element) return null;
  return (
    <CommitField
      label={label}
      value={element.textContent ?? ""}
      onCommit={(value) =>
        edit.change((el) => {
          const target = el.querySelector(find);
          if (target) target.textContent = value;
        })
      }
    />
  );
}

/** What's shown when nothing on the slide is picked. */
export function SlideFields({
  edit,
  hidden,
  canHide,
  onHide,
}: {
  edit: Editing;
  hidden: boolean;
  canHide: boolean;
  onHide: () => void;
}) {
  const { element } = edit;
  const cover = element.classList.contains("hero");
  const background = element.getAttribute("data-bg") ?? "";
  const toc = element.querySelector(".toc");
  return (
    <>
      <CommitField
        label="Name in the slide list"
        value={element.getAttribute("data-title") ?? ""}
        onCommit={(value) => edit.change((el) => el.setAttribute("data-title", value))}
      />
      {cover ? (
        <>
          <TextOf edit={edit} find=".kick" label="Line above the title" />
          <TextOf edit={edit} find=".sv" label="Badge word" />
          <TextOf edit={edit} find=".sn" label="Badge number" />
          <TextOf edit={edit} find="h1" label="Title" />
          {toc && <Hint>Click the contents chips on the slide to change them.</Hint>}
        </>
      ) : (
        <TextOf edit={edit} find=".eb" label="Line above the title" />
      )}
      <Group title="Background">
        <ButtonGroup
          stretch
          label="Background"
          value={BACKGROUNDS.some((b) => b.value === background) ? background : ""}
          options={BACKGROUNDS}
          onChange={(value) => edit.change((el) => el.setAttribute("data-bg", value))}
        />
      </Group>
      <Switch
        label="Hide this slide"
        checked={hidden}
        disabled={!canHide}
        onCheckedChange={onHide}
      />
      <Hint>{cover ? "Cover slide" : "Standard slide"}</Hint>
    </>
  );
}
