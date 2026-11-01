// @vitest-environment jsdom
import { createServer, type Server } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import pixelmatch from "pixelmatch";
import { chromium, type Browser, type Page } from "playwright-core";
import { PNG } from "pngjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sanitizeSlides } from "../../src/lib/deck/sanitize";

/**
 * The acceptance test for the port (docs/ARCHITECTURE-DECKS.md §1): every demo slide, fully
 * revealed, must look like the owner's template. Slides take the real route, through the
 * sanitiser, onto the page the app serves. Uses the Edge already on Windows, so nothing is
 * downloaded. Differences are saved to tests/parity/out to look at.
 */

const TEMPLATE = readFileSync("reference/lop-deck/deck-template.html", "utf8");
const SLIDE_COUNT = 8;
// Anti-aliasing noise, not a visible difference.
const MAX_CHANGED = 0.001;
const OUT = "tests/parity/out";

function between(text: string, from: string, to: string): string {
  const start = text.indexOf(from) + from.length;
  return text.slice(start, text.indexOf(to, start));
}

/** The same page session.rs serves, with the files inlined. */
function appPage(): string {
  const start =
    "<!-- SLIDES:START (build_deck.py replaces everything between these two markers) -->";
  const slides = sanitizeSlides(between(TEMPLATE, start, "<!-- SLIDES:END -->")).html;
  const theme = between(TEMPLATE, '<style id="theme">', "</style></head>");
  const file = (name: string) => readFileSync(`src/runtime/${name}`, "utf8");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Slides</title>
    <style>${file("engine.css")}</style><style>${file("app.css")}</style><style>${theme}</style></head><body>
    <div id="stage"><div id="bgl"><div class="blob b0"></div><div class="blob b1"></div>
    <div class="blob b2"></div><div class="blob b3"></div></div>${slides}</div><div id="ov"></div>
    <script>${file("engine.js")}</script></body></html>`;
}

const STILL = `*,*::before,*::after{animation:none!important;transition:none!important}
  #dock,#inkwrap,#toast,#pc,#wb,#ov{display:none!important}`;

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getAnimations().forEach((a) => a.finish());
  });
  await page.waitForTimeout(120);
}

async function shot(page: Page): Promise<PNG> {
  const clip = { x: 0, y: 0, width: 1920, height: 1080 };
  return PNG.sync.read(await page.screenshot({ clip, animations: "disabled" }));
}

describe("slides match the template", () => {
  let browser: Browser;
  let server: Server;
  let base: string;
  let template: Page;
  let app: Page;

  beforeAll(async () => {
    mkdirSync(OUT, { recursive: true });
    const pages: Record<string, string> = { "/template": TEMPLATE, "/app": appPage() };
    server = createServer((request, response) => {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(pages[request.url ?? ""] ?? "");
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    browser = await chromium.launch({ channel: "msedge" });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      reducedMotion: "reduce",
    });
    template = await context.newPage();
    app = await context.newPage();
    await template.goto(`${base}/template`);
    await app.goto(`${base}/app`);
    await template.addStyleTag({ content: STILL });
    await app.addStyleTag({ content: STILL });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    server?.close();
  });

  for (let slide = 0; slide < SLIDE_COUNT; slide++) {
    it(`slide ${slide + 1}`, async () => {
      await template.evaluate((i) => {
        const page = window as unknown as { __go: (i: number, end: boolean) => void };
        const all = window as unknown as { __all: () => void };
        page.__go(i, true);
        all.__all();
      }, slide);
      await app.evaluate((i) => {
        window.postMessage({ v: 1, type: "mode", payload: { mode: "edit", slide: i } }, "*");
      }, slide);
      await app.waitForTimeout(150);
      await settle(template);
      await settle(app);

      const want = await shot(template);
      const got = await shot(app);
      const diff = new PNG({ width: want.width, height: want.height });
      const changed = pixelmatch(want.data, got.data, diff.data, want.width, want.height, {
        threshold: 0.12,
      });
      const share = changed / (want.width * want.height);
      if (share > 0) {
        writeFileSync(`${OUT}/slide-${slide + 1}-want.png`, PNG.sync.write(want));
        writeFileSync(`${OUT}/slide-${slide + 1}-got.png`, PNG.sync.write(got));
        writeFileSync(`${OUT}/slide-${slide + 1}-diff.png`, PNG.sync.write(diff));
      }
      expect(share, `share of pixels that differ on slide ${slide + 1}`).toBeLessThanOrEqual(
        MAX_CHANGED,
      );
    }, 30_000);
  }
});
