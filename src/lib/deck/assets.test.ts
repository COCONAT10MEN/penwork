import { describe, expect, it } from "vitest";
import { extractImages } from "./assets";

const PNG = "iVBORw0KGgo="; // the first bytes of a PNG, enough for a name

describe("extractImages", () => {
  it("moves a data image into assets and points the slide at it", async () => {
    const { html, assets } = await extractImages(`<img src="data:image/png;base64,${PNG}">`);
    expect(assets).toHaveLength(1);
    expect(assets[0]?.name).toMatch(/^assets\/[0-9a-f]{32}\.png$/);
    expect(html).toBe(`<img src="${assets[0]?.name}">`);
  });

  it("stores identical images once", async () => {
    const image = `<img src="data:image/png;base64,${PNG}">`;
    const { html, assets } = await extractImages(image + image);
    expect(assets).toHaveLength(1);
    expect(html).not.toContain("data:");
  });

  it("gives each type its own extension", async () => {
    const { assets } = await extractImages(
      `<img src="data:image/jpeg;base64,${PNG}"><image href="data:image/svg+xml;base64,PHN2Zz4="/>`,
    );
    expect(assets.map((a) => a.name.split(".").pop()).sort()).toEqual(["jpg", "svg"]);
  });

  it("leaves everything else alone", async () => {
    const html = `<img src="assets/a.png"><p>data:image/png;base64,${PNG}</p>`;
    expect(await extractImages(html)).toEqual({ html, assets: [] });
  });
});
