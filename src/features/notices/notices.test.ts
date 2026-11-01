import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  answerQuestion,
  askGoAhead,
  askThreeWay,
  clearNotice,
  notify,
  showError,
  useNotices,
} from "./notices";

const save = { title: "Save?", text: "", yes: "Save", no: "Don't save", cancel: "Cancel" };

beforeEach(() => useNotices.setState({ notice: null, questions: [] }));

describe("notify", () => {
  it("shows the latest message only", () => {
    notify("One");
    notify("Two");
    expect(useNotices.getState().notice?.message).toBe("Two");
  });

  it("isn't cleared by an older message's timer", () => {
    notify("One");
    const first = useNotices.getState().notice?.id ?? 0;
    notify("Two");
    clearNotice(first);
    expect(useNotices.getState().notice?.message).toBe("Two");
  });
});

describe("questions", () => {
  it("gives back the choice", async () => {
    const answer = askThreeWay(save);
    answerQuestion("no");
    await expect(answer).resolves.toBe("no");
  });

  it("puts the main action last and treats dismissing as cancel", () => {
    void askThreeWay(save);
    const [question] = useNotices.getState().questions;
    expect(question?.choices.at(-1)?.label).toBe("Save");
    expect(question?.dismiss).toBe("cancel");
  });

  it("asks one at a time, in order", async () => {
    const first = askGoAhead({ title: "1", text: "", ok: "Yes", cancel: "No" });
    const second = askGoAhead({ title: "2", text: "", ok: "Yes", cancel: "No" });
    expect(useNotices.getState().questions[0]?.title).toBe("1");
    answerQuestion("ok");
    await expect(first).resolves.toBe(true);
    expect(useNotices.getState().questions[0]?.title).toBe("2");
    answerQuestion("cancel");
    await expect(second).resolves.toBe(false);
  });

  it("marks errors, and needs only OK", () => {
    showError("Nope");
    const [question] = useNotices.getState().questions;
    expect(question?.danger).toBe(true);
    expect(question?.choices).toHaveLength(1);
  });

  it("ignores an answer with nothing on screen", () => {
    const spy = vi.fn();
    useNotices.subscribe(spy);
    answerQuestion("ok");
    expect(spy).not.toHaveBeenCalled();
  });
});
