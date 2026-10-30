import { describe, expect, it } from "vitest";
import { fileTitle, readManifest } from "./manifest";

describe("readManifest", () => {
  it("reads a full manifest", () => {
    const m = readManifest(
      { title: "Waves", lang: "ar", dir: "rtl", stage: { w: 1280, h: 720 } },
      "fallback",
    );
    expect(m).toMatchObject({ title: "Waves", lang: "ar", dir: "rtl", stage: { w: 1280, h: 720 } });
  });

  it("fills in defaults rather than refusing", () => {
    expect(readManifest({}, "File name")).toMatchObject({
      title: "File name",
      lang: "en",
      dir: "ltr",
      stage: { w: 1920, h: 1080 },
    });
    expect(readManifest(null, "x").title).toBe("x");
    expect(readManifest({ title: "   " }, "x").title).toBe("x");
    expect(readManifest({ stage: { w: -1, h: "big" } }, "x").stage).toEqual({ w: 1920, h: 1080 });
    expect(readManifest({ dir: "sideways" }, "x").dir).toBe("ltr");
  });

  it("keeps keys it doesn't know", () => {
    expect(readManifest({ future: 1 }, "x").raw.future).toBe(1);
  });
});

describe("fileTitle", () => {
  it("works on Windows and other paths", () => {
    expect(fileTitle("C:\\Decks\\Waves.pwpptx")).toBe("Waves");
    expect(fileTitle("/home/a/My deck.pwpptx")).toBe("My deck");
    expect(fileTitle("noext")).toBe("noext");
  });
});
