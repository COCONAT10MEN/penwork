import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button, ButtonGroup, Slider } from "../../../ui";
import { showError } from "../../notices/notices";
import { CommitArea, CommitField, Group, Hint, type Editing } from "./fields";

export function DiagramFields({ edit }: { edit: Editing }) {
  const { element } = edit;
  const svg = element.querySelector("svg");
  const height = parseInt((svg as SVGElement | null)?.style.height ?? "", 10) || 520;
  const caption = element.querySelector(".cap");
  const parts = Array.from(element.querySelectorAll("[data-part]")).map((p) =>
    p.getAttribute("data-part"),
  );
  const labels = Array.from(element.querySelectorAll("svg text"));
  return (
    <>
      {svg && (
        <Group title="Height">
          <Slider
            label="Height"
            min={200}
            max={760}
            step={10}
            value={height}
            format={(v) => `${v} px`}
            onChange={(v) => edit.preview({ prop: "--pw-svg", value: `${v}px` })}
            onCommit={(v) =>
              edit.change((el) => {
                const target = el.querySelector("svg") as SVGElement | null;
                if (target) target.style.height = `${v}px`;
              })
            }
          />
        </Group>
      )}
      {caption && (
        <CommitField
          label="Caption"
          value={caption.textContent ?? ""}
          onCommit={(value) =>
            edit.change((el) => {
              const target = el.querySelector(".cap");
              if (target) target.textContent = value;
            })
          }
        />
      )}
      {labels.length > 0 && (
        <Group title="Labels">
          {labels.map((label, at) => (
            <CommitField
              key={at}
              label={`Label ${at + 1}`}
              value={label.textContent ?? ""}
              onCommit={(value) =>
                edit.change((el) => {
                  const target = el.querySelectorAll("svg text")[at];
                  if (target) target.textContent = value;
                })
              }
            />
          ))}
        </Group>
      )}
      {parts.length > 0 && <Hint>Parts a step can highlight: {parts.join(", ")}</Hint>}
      {svg && (
        <CommitArea
          label="SVG source (advanced)"
          rows={6}
          value={svg.outerHTML}
          onCommit={(value) =>
            edit.change((el) => {
              el.querySelector("svg")?.insertAdjacentHTML("beforebegin", value);
              el.querySelectorAll("svg")[1]?.remove();
            })
          }
        />
      )}
      <Hint>Double-click a label on the slide to type it there.</Hint>
    </>
  );
}

export function ImageFields({ edit }: { edit: Editing }) {
  const image = edit.element as HTMLImageElement;
  const replace = async () => {
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
    });
    if (typeof path !== "string") return;
    try {
      const name = await invoke<string>("add_image_file", { token: edit.token, path });
      edit.change((el) => el.setAttribute("src", name));
    } catch {
      showError("That image couldn't be added. It may be too big or damaged.");
    }
  };
  return (
    <>
      <Button variant="tonal" size="small" icon="image" onClick={() => void replace()}>
        Replace image
      </Button>
      <CommitField
        label="Description for screen readers"
        value={image.getAttribute("alt") ?? ""}
        onCommit={(value) => edit.change((el) => el.setAttribute("alt", value))}
      />
      <Group title="Fit">
        <ButtonGroup
          stretch
          label="Fit"
          value={image.style.objectFit === "contain" ? "contain" : "cover"}
          options={[
            { value: "cover", label: "Fill" },
            { value: "contain", label: "Show all" },
          ]}
          onChange={(fit) =>
            edit.change((el) => {
              (el as HTMLElement).style.objectFit = fit;
            })
          }
        />
      </Group>
    </>
  );
}
