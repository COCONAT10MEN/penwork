import { describe, expect, it } from "vitest";
import { greeting, whenOpened } from "./greeting";

describe("greeting", () => {
  it("follows the time of day", () => {
    expect(greeting(3)).toBe("Good evening");
    expect(greeting(5)).toBe("Good morning");
    expect(greeting(11)).toBe("Good morning");
    expect(greeting(12)).toBe("Good afternoon");
    expect(greeting(17)).toBe("Good afternoon");
    expect(greeting(18)).toBe("Good evening");
  });
});

describe("whenOpened", () => {
  const now = new Date(2026, 9, 30, 9, 0);
  it("says today and yesterday", () => {
    expect(whenOpened(new Date(2026, 9, 30, 8, 0).toISOString(), now)).toBe("Today");
    expect(whenOpened(new Date(2026, 9, 29, 23, 0).toISOString(), now)).toBe("Yesterday");
  });

  it("uses a date for anything older", () => {
    expect(whenOpened(new Date(2026, 9, 1).toISOString(), now)).toMatch(/1|Oct/);
  });
});
