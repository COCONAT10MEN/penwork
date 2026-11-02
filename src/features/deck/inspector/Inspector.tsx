import { useMemo, type ReactNode } from "react";
import { elementAt } from "../../../lib/deck/slideEdit";
import { isHidden, type DeckSlide } from "../../../lib/deck/slideOps";
import { Button, Icon, IconButton, Surface } from "../../../ui";
import { ElementFields, EachItemSteps } from "./ElementFields";
import { CommitArea, Group, Hint, type Editing } from "./fields";
import styles from "./Inspector.module.css";
import { SlideFields } from "./SlideFields";
import { StepFields } from "./StepFields";

export type EditMode = "edit" | "steps" | "notes";

export interface Picked {
  n: number;
  tag: string;
  crumbs: { n: number; label: string }[];
}

function Crumbs({
  slide,
  picked,
  onPick,
}: {
  slide: number;
  picked: Picked | null;
  onPick: (n: number) => void;
}) {
  return (
    <nav className={styles.crumbs} aria-label="Where this is on the slide">
      <button type="button" className={styles.crumb} onClick={() => onPick(-1)}>
        Slide {slide + 1}
      </button>
      {picked?.crumbs.map((crumb) => (
        <span key={crumb.n} className={styles.crumbPart}>
          <span aria-hidden="true">›</span>
          <button
            type="button"
            className={styles.crumb}
            aria-current={crumb.n === picked.n || undefined}
            onClick={() => onPick(crumb.n)}
          >
            {crumb.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

function StepsPanel({
  step,
  steps,
  onStep,
}: {
  step: number;
  steps: number;
  onStep: (step: number) => void;
}) {
  return (
    <Group title="Steps on this slide">
      {steps === 0 ? (
        <Hint>
          Nothing on this slide appears on click yet. Pick something and turn it on below.
        </Hint>
      ) : (
        <div className={styles.stepper}>
          <IconButton
            icon="chevron_left"
            label="Previous step"
            disabled={step <= 0}
            onClick={() => onStep(step - 1)}
          />
          <span className={styles.stepCount}>
            {step === 0 ? "Before the first click" : `Step ${step} of ${steps}`}
          </span>
          <IconButton
            icon="chevron_right"
            label="Next step"
            disabled={step >= steps}
            onClick={() => onStep(step + 1)}
          />
        </div>
      )}
    </Group>
  );
}

/** The panel on the right of the edit view: what's picked, and everything about it. */
export function Inspector({
  mode,
  slide,
  slideData,
  picked,
  step,
  steps,
  canHide,
  token,
  onChange,
  onPreview,
  onPick,
  onHide,
  onStep,
  onNotes,
  problems,
  ask,
}: {
  mode: EditMode;
  slide: number;
  slideData: DeckSlide | undefined;
  picked: Picked | null;
  step: number;
  steps: number;
  canHide: boolean;
  token: string;
  onChange: (n: number, tag: string, change: (element: Element) => void) => void;
  onPreview: (n: number, message: { prop?: string; value?: string; tex?: string }) => void;
  onPick: (n: number) => void;
  onHide: () => void;
  onStep: (step: number) => void;
  onNotes: (text: string) => void;
  problems: string[];
  ask: ReactNode;
}) {
  const html = slideData?.html ?? "";
  const root = useMemo(() => elementAt(html, 0), [html]);
  const element = useMemo(() => (picked ? elementAt(html, picked.n) : null), [html, picked]);
  const editing = (target: Element, n: number): Editing | null =>
    root && {
      element: target,
      slide: root,
      token,
      change: (change) => onChange(n, target.tagName, change),
      preview: (message) => onPreview(n, message),
    };
  const slideEdit = root ? editing(root, 0) : null;
  const pickedEdit = element && picked ? editing(element, picked.n) : null;
  return (
    <Surface
      material="glass"
      className={styles.inspector}
      role="complementary"
      aria-label="Inspector"
    >
      {mode === "notes" ? (
        <CommitArea
          key={slideData?.id}
          label={`Speaker notes for slide ${slide + 1}`}
          rows={18}
          value={slideData?.notes ?? ""}
          onCommit={onNotes}
        />
      ) : (
        <>
          <Crumbs slide={slide} picked={picked} onPick={onPick} />
          {problems.map((problem) => (
            <p key={problem} className={styles.problem} role="status">
              <Icon name="warning" size={18} filled />
              {problem}
            </p>
          ))}
          {mode === "steps" && <StepsPanel step={step} steps={steps} onStep={onStep} />}
          {pickedEdit ? (
            <div key={`${slide}-${picked?.n}`} className={styles.fields}>
              <ElementFields edit={pickedEdit} />
              {element?.matches("ul,ol") && <EachItemSteps edit={pickedEdit} />}
              <StepFields edit={pickedEdit} />
              <Button variant="text" size="small" icon="deselect" onClick={() => onPick(-1)}>
                Back to the slide
              </Button>
            </div>
          ) : (
            slideEdit && (
              <div key={slide} className={styles.fields}>
                <SlideFields
                  edit={slideEdit}
                  hidden={slideData ? isHidden(slideData) : false}
                  canHide={canHide}
                  onHide={onHide}
                />
              </div>
            )
          )}
          {ask}
        </>
      )}
    </Surface>
  );
}
