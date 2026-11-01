// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { installPress } from "./press";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

window.matchMedia ??= (() => ({ matches: false })) as unknown as typeof window.matchMedia;

describe("press", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("marks where a control was pressed", () => {
    installPress();
    document.body.innerHTML = `<button class="pw-press"><span>x</span></button>`;
    const span = document.querySelector("span");
    span?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 5 }));
    const button = document.querySelector("button");
    expect(button?.style.getPropertyValue("--pw-x")).toBe("5px");
    window.dispatchEvent(new MouseEvent("pointerup"));
  });

  it("plays a click too short to see through to its end", async () => {
    document.body.innerHTML = `<button class="pw-press">x</button>`;
    const button = document.querySelector("button");
    button?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    window.dispatchEvent(new MouseEvent("pointerup"));
    let peak = 0;
    for (let i = 0; i < 30; i++) {
      await wait(16);
      peak = Math.max(peak, Number(button?.style.getPropertyValue("--pw-press") || 0));
    }
    expect(peak).toBeGreaterThan(0.75);
  });
});
