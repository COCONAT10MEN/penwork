import { describe, expect, it } from "vitest";
import { parseRuntimeMessage } from "./bridge";

const msg = (type: string, payload: unknown, v: unknown = 1) => ({ v, id: "1", type, payload });

describe("parseRuntimeMessage", () => {
  it("accepts valid messages", () => {
    expect(parseRuntimeMessage(msg("ready", { total: 8 }))).toEqual({ type: "ready", total: 8 });
    expect(parseRuntimeMessage(msg("state", { slide: 2, step: 1, steps: 3, total: 8 }))).toEqual({
      type: "state",
      slide: 2,
      step: 1,
      steps: 3,
      total: 8,
    });
    expect(parseRuntimeMessage(msg("pick", { slide: 4 }))).toEqual({ type: "pick", slide: 4 });
    expect(parseRuntimeMessage(msg("end", {}))).toEqual({ type: "end" });
    expect(parseRuntimeMessage(msg("ink", { id: "s-1", strokes: [] }))).toEqual({
      type: "ink",
      id: "s-1",
      strokes: [],
    });
    expect(parseRuntimeMessage(msg("key", { key: "Escape", ctrl: true }))).toEqual({
      type: "key",
      key: "Escape",
      ctrl: true,
      shift: false,
      alt: false,
    });
  });

  it("ignores everything else", () => {
    for (const bad of [
      null,
      "ready",
      42,
      {},
      msg("ready", { total: 8 }, 2),
      msg("ready", { total: -1 }),
      msg("ready", { total: "8" }),
      msg("ready", null),
      msg("state", { slide: 1.5, step: 0, steps: 0, total: 8 }),
      msg("state", { slide: 1, total: 8 }),
      msg("pick", { slide: "1" }),
      msg("ink", { id: 5 }),
      msg("exportToolbar", { text: 5 }),
      msg("key", { key: 5 }),
      msg("key", { key: "x".repeat(33) }),
      msg("deleteEverything", {}),
    ]) {
      expect(parseRuntimeMessage(bad)).toBeNull();
    }
  });
});
