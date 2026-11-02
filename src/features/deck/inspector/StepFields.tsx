import { ButtonGroup, Switch } from "../../../ui";
import { Group, type Editing } from "./fields";

const ANIMATIONS = ["l", "r", "z"];

/** Where the step is: on this element, or on a wrapper around it. */
function stepOf(element: Element): Element | null {
  return element.closest(".st");
}

/** Appears on click: for anything on a slide. */
export function StepFields({ edit }: { edit: Editing }) {
  const step = stepOf(edit.element);
  const parts = Array.from(edit.slide.querySelectorAll("[data-part]"))
    .map((p) => p.getAttribute("data-part") ?? "")
    .filter((p, i, all) => p && all.indexOf(p) === i);
  const changeStep = (how: (target: Element) => void) =>
    edit.change((el) => {
      const target = stepOf(el);
      if (target) how(target);
    });
  const animation = ANIMATIONS.find((a) => step?.classList.contains(a)) ?? "fade";
  return (
    <Group title="Steps">
      <Switch
        label="Appears on click"
        checked={step !== null}
        onCheckedChange={(on) =>
          edit.change((el) => {
            if (on) {
              el.classList.add("st");
              return;
            }
            const target = stepOf(el);
            target?.classList.remove("st", ...ANIMATIONS);
            target?.removeAttribute("data-st");
            target?.removeAttribute("data-hl");
          })
        }
      />
      {step && (
        <>
          <ButtonGroup
            stretch
            label="How it appears"
            value={animation}
            options={[
              { value: "fade", label: "Fade" },
              { value: "l", label: "Left" },
              { value: "r", label: "Right" },
              { value: "z", label: "Zoom" },
            ]}
            onChange={(next) =>
              changeStep((target) => {
                target.classList.remove(...ANIMATIONS);
                if (next !== "fade") target.classList.add(next);
              })
            }
          />
          <Switch
            label="Together with the previous step"
            checked={step.getAttribute("data-st") === "="}
            onCheckedChange={(on) =>
              changeStep((target) => {
                if (on) target.setAttribute("data-st", "=");
                else target.removeAttribute("data-st");
              })
            }
          />
          {parts.length > 0 && (
            <ButtonGroup
              stretch
              label="Highlights diagram part"
              value={step.getAttribute("data-hl") ?? ""}
              options={[
                { value: "", label: "None" },
                ...parts.map((part) => ({ value: part, label: part })),
              ]}
              onChange={(next) =>
                changeStep((target) => {
                  if (next) target.setAttribute("data-hl", next);
                  else target.removeAttribute("data-hl");
                })
              }
            />
          )}
        </>
      )}
    </Group>
  );
}
